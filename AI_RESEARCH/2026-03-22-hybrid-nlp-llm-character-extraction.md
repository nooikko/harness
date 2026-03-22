# Research: Hybrid NLP + LLM Character Extraction Architectures
Date: 2026-03-22

## Summary

Research into proven architectures for combining structured NLP (NER, coreference resolution) with LLM reasoning for character extraction from dialogue/transcripts. Focused specifically on the three failure modes present in the storytelling plugin: (1) LLM puts descriptions in name fields, (2) LLM fails to merge cross-chunk references to the same person, (3) LLM trusts bad existing records instead of correcting them.

## Prior Research

- `AI_RESEARCH/2026-03-17-storytelling-plugin-plan.md` — original plugin design

## Current Implementation (Storytelling Plugin)

The current pipeline in `packages/plugins/storytelling/src/_helpers/tool-import-transcript.ts`:

1. Chunk transcript into ~20 message groups (`chunk-transcript.ts`)
2. For each chunk: build a mega-prompt with existing characters, locations, recent moments, and chunk content
3. Send to claude-sonnet-4-6 with `ctx.invoker.invoke()`
4. Parse JSON output with Zod schema (`parse-import-result.ts`)
5. Apply extraction to DB (`apply-extraction.ts`)

The Zod schema does enforce `name: z.string().min(1)` but nothing stops the LLM from putting a sentence there. There is no cross-chunk entity resolution pass — each chunk sees a character list, but if the LLM creates "mentioned; not present" as a name in chunk 1, that bad record is passed as context to chunk 2.

## Current Findings

### 1. Proven Hybrid Architectures: NER + LLM

**Architecture A: NER-first, LLM-refines**
- Traditional NER (spaCy, GLiNER) extracts candidate mentions — returns only spans present in the text
- LLM receives the candidate list + context and performs: deduplication, coreference resolution, field enrichment
- NER acts as a grounding filter: it physically cannot return a description where a name should be because it extracts text spans

Pattern:
```
Text → GLiNER("person") → ["Quinn", "Mr. Kim", "he", "the coach"] → LLM merge pass → canonical character list
```

**Architecture B: LLM-extracts, validator-rejects**
- LLM does full extraction with structured output
- Post-processing validator checks each name field against heuristics (word count, capitalization, no verbs)
- Names that fail are either rejected (logged as unresolved mentions) or sent to a second LLM pass with explicit correction instructions

**Architecture C: Dual-LLM (from LlmLink, COLING 2025)**
- LLM-A: local NER — identifies named entity mentions within each chunk
- LLM-B: coreference resolver — maintains a memory of discovered characters (name + description) and resolves whether new mentions match existing entries
- LLM-B uses a compact character registry rather than full conversation history, reducing token cost
- Source: https://aclanthology.org/2025.coling-main.751/

**Architecture D: Dependency parser as cheaper alternative**
- Pure dependency parsing (spaCy) achieves 94% of LLM accuracy for entity extraction at a fraction of the cost
- Useful as a pre-filter before sending candidates to the LLM

### 2. GLiNER — Most Practical Library for NER-first Approach

GLiNER (NAACL 2024) is the strongest practical choice for a character-name pre-pass:

- Zero-shot: entity types are specified at inference time, not baked into model weights
- Discriminative (not generative): cannot hallucinate — it can only return text spans that exist in the input
- Fast: parallel entity extraction vs. sequential token generation of LLMs
- Python API:
  ```python
  from gliner import GLiNER
  model = GLiNER.from_pretrained("urchade/gliner_medium-v2.1")
  entities = model.predict_entities(text, ["person", "character name"], threshold=0.5)
  # Returns: [{"text": "Quinn", "label": "person", "score": 0.97}, ...]
  ```
- spaCy wrapper available: `gliner-spacy` package
- Source: https://github.com/urchade/GLiNER

**Critical property**: Every entry in `entities` is a substring of the input text. If the LLM would have written "mentioned; does not yet know Quinn exists", GLiNER simply returns nothing for that span — or returns "Quinn" if Quinn was mentioned.

### 3. BookNLP — Literary Character Extraction Reference

BookNLP (Python, actively maintained) is the gold standard for literary character extraction:

- Full pipeline: POS tagging → NER → name clustering → coreference resolution → quotation attribution → gender inference
- **Name clustering**: automatically groups "Tom", "Tom Sawyer", "Mr. Sawyer", "Thomas Sawyer" → TOM_SAWYER
- **Coreference**: links pronouns to character clusters
- Constrained approach: names cluster first, then pronouns resolve to names — prevents spurious merges
- Input: plain text. Output: `.book` JSON with character summaries, `.entities` with coreference IDs
- API:
  ```python
  from booknlp.booknlp import BookNLP
  booknlp = BookNLP("en", {"pipeline": "entity,quote,supersense,event,coref", "model": "big"})
  booknlp.process(input_file, output_directory, book_id)
  ```
- Source: https://github.com/booknlp/booknlp

BookNLP is Python-only. For a TypeScript codebase, it would need to run as a subprocess or microservice. The name-clustering logic is the most transferable concept even if the library itself is not used directly.

### 4. Two-Pass Extraction: Mentions → Identity Resolution

This pattern directly addresses failure modes 2 and 3.

**Pass 1 — Mention Extraction (per chunk)**
- Extract all character mentions from the chunk (names, pronouns, role references)
- Output is a flat list of raw mentions: `["Quinn", "she", "the coach", "Mr. Kim", "the new girl"]`
- Can be done with GLiNER, spaCy NER, or a very tightly scoped LLM prompt
- Key constraint: pass 1 never writes to the character registry

**Pass 2 — Identity Resolution (cross-chunk, accumulated)**
- Receives: the raw mention list + the existing character registry
- Decides: which mentions map to existing characters, which are new characters, which are pronouns resolvable by context
- Output: a merge/create diff against the character registry
- The LLM in pass 2 is not asked to invent names — it is asked to match or classify

This two-pass structure eliminates failure mode 1 because pass 1 (NER/GLiNER) only returns text spans — it cannot return "mentioned; not present" as a name. The LLM in pass 2 receives verified name candidates, not free-form text.

**LlmLink approach to memory**: Rather than passing the full character list each chunk, maintain a compact character memory:
```json
{
  "characters": [
    { "id": "char_001", "canonical": "Quinn", "aliases": ["she", "the girl"], "description": "protagonist, gymnast" },
    { "id": "char_002", "canonical": "Mr. Kim", "aliases": ["the coach", "him"], "description": "gymnastics coach" }
  ]
}
```
The resolver LLM receives this compact memory plus new mentions and outputs an update diff.

### 5. Structured Output Validation for Name Fields

**Claude structured outputs (official docs)**

Two mechanisms:
1. `output_config.format` with `type: "json_schema"` — constrained decoding guarantees valid JSON matching schema
2. `strict: true` on tool definitions — tool input always matches schema exactly

Supported field-level constraints in JSON Schema:
- `type`, `enum`, `required`, `additionalProperties: false`
- `minItems` / `maxItems` on arrays
- `format` on strings (date, email)

NOT directly enforced by constrained decoding:
- `minLength` / `maxLength`
- `pattern` (regex)
- `minimum` / `maximum`

However, the Python SDK's `client.messages.parse()` with Pydantic models will:
1. Strip unsupported constraints from the schema sent to Claude
2. Add the constraint text to the field description
3. Validate the response against the full Pydantic schema after generation

This means you can write:
```python
class Character(BaseModel):
    name: str = Field(..., min_length=1, max_length=50, description="The character's proper name only (e.g. 'Quinn', 'Mr. Kim'). Never a description or status.")
    action: Literal["create", "update"]
```

The `max_length=50` is enforced post-generation by Pydantic. Combined with a very explicit description, this significantly reduces the "description in name field" failure mode.

**Tool use with pattern constraints**

For tool_use (not structured output mode), `pattern` constraints can be included in `input_schema` and Claude will attempt to honor them, though enforcement is not guaranteed at the token level:
```json
{
  "name": "register_character",
  "strict": true,
  "input_schema": {
    "properties": {
      "name": {
        "type": "string",
        "maxLength": 50,
        "description": "Proper name only — 1-3 words, capitalized. Examples: 'Quinn', 'Mr. Kim', 'Coach Sarah'. NEVER a description, role, or status."
      }
    }
  }
}
```

Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
Source: https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use

### 6. Post-Processing Validation for Name Fields

The most reliable defense is a lightweight post-processing validator that runs after parsing, before writing to DB:

**Heuristics that detect "description in name field":**
- Word count > 4 → likely a description
- Contains semicolon, comma, or colon → likely a description
- Contains any of: "not", "does", "mentioned", "present", "unknown", "never", "only", "yet" → likely a status description
- All lowercase → likely a status/description
- Sentence-length string (contains a verb in first 3 words) → reject

**Implementation pattern:**
```typescript
type IsValidCharacterName = (name: string) => boolean;

const isValidCharacterName: IsValidCharacterName = (name) => {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 60) return false;
  const words = trimmed.split(/\s+/);
  if (words.length > 5) return false;  // too long for a name
  if (/[;,:]/.test(trimmed)) return false;  // description markers
  if (/\b(not|does|mentioned|present|unknown|never|only|yet|who|which)\b/i.test(trimmed)) return false;
  return true;
};
```

Invalid names can be moved to a `suspectedDescriptions` array for human review rather than silently discarded.

### 7. Cross-Chunk Coreference: The Prompt Cache / Character Registry Pattern

The most practically adopted pattern from production systems (LINK-KG, LlmLink) is a **type-specific prompt cache** — a compact registry passed to each chunk:

```
## Known Characters (do NOT create new entries for these — only use their IDs)
- Quinn [id: char_001] — protagonist, gymnast. Also referred to as: "she", "the girl", "Quinn Mitchell"
- Mr. Kim [id: char_002] — gymnastics coach. Also referred to as: "the coach", "him", "Coach Kim"

## Unresolved Mentions from Previous Chunks
- "the new girl" — not yet matched to a known character
```

The LLM is instructed: "If a mention in this chunk could refer to an existing character, use their ID. Only create a new character if you are certain this is someone not in the list above."

This directly addresses failure mode 2 (no merging across chunks) by explicitly including the accumulated alias list.

### 8. Fixing Failure Mode 3: Bad Records Persist

The current pipeline passes bad records as context to subsequent chunks. The LLM sees "- mentioned; not present; does not yet know Quinn exists (id: char_007)" and treats it as a valid character.

Fixes:

**Option A: Schema enforcement on write**
Run the `isValidCharacterName` validator before `applyExtraction`. Characters with invalid names are not written to DB — they go to a `pendingReview` table instead.

**Option B: Separate character-creation pass**
Never create characters during chunk extraction. Chunk extraction only identifies name mentions. A separate final pass reviews all mentions and creates canonical character records. This is the two-pass architecture applied to character creation specifically.

**Option C: Explicit correction pass**
After all chunks are processed, run a third pass: "Here are all character records in the database. Identify any where the name field looks like a description or status. For each, extract the actual name if present, or mark for deletion."

### 9. Known LLM Entity Extraction Failure Modes (from GDELT experiments)

From production experiments at scale:
- A single apostrophe ("NATO's" vs "NATOs") completely changes which entities are extracted
- Word order of surrounding context changes extraction results
- Hallucinated variants of the same entity appear across runs (e.g., "Santiago_Pea" vs "Santiago_Peña")
- At temperature > 0, the same text can produce different entity lists across runs

Mitigations:
- Temperature 0.0 for extraction tasks
- Multi-run consensus (run 2-3 times, take entities that appear in majority of runs) — expensive but effective
- Cross-reference against known character list (exactly what the existing prompt does, but needs the list to be clean first)

Source: https://blog.gdeltproject.org/experiments-in-entity-extraction-using-llms-hallucination-how-a-single-apostrophe-can-change-the-results/

## Key Takeaways

1. **GLiNER as name guard** (Confidence: HIGH): Run GLiNER on each chunk before the LLM extraction pass. Collect all `person` spans. These are the only valid values for the `name` field. LLM is then asked to enrich/classify these spans, not invent names. This eliminates failure mode 1 at the source.

2. **Character registry with alias accumulation** (Confidence: HIGH): Replace the simple character list with a registry that includes known aliases per character. Update it after each chunk. The LLM receives this registry and is explicitly instructed to resolve mentions to existing IDs before creating new records.

3. **Post-write validator** (Confidence: HIGH): `isValidCharacterName()` runs before any `applyExtraction()` call. Filters out description strings. Sends invalid names to a review queue rather than writing them to DB.

4. **Two-pass architecture** (Confidence: MEDIUM): Pass 1 extracts raw mentions (NER), pass 2 resolves identity. Cleaner separation but doubles LLM calls. Most valuable for large transcripts where cross-chunk identity confusion is frequent.

5. **Structured output with `strict: true`** (Confidence: HIGH): Switch from free-form JSON prompt to tool_use with `strict: true`. Add `maxLength: 50` and detailed description to the `name` field. This does not guarantee correctness but reduces the probability of description-length strings being placed in name fields.

6. **GLiNER runs in Python only** (Confidence: HIGH): For a TypeScript/Node.js codebase, GLiNER would need to run as a Python subprocess or a small FastAPI microservice. BookNLP has the same constraint. If adding an external Python dependency is unacceptable, the post-processing validator and character registry approaches can be implemented entirely in TypeScript.

## Architecture Recommendation (Zero New Dependencies)

For the storytelling plugin specifically, three changes can be made in TypeScript with no new dependencies:

**Change 1: Character name validator (before DB write)**
In `apply-extraction.ts`, add a `isValidCharacterName()` check on every character `name` field before upsert. Invalid names go to a log/review queue, not the DB.

**Change 2: Character registry with aliases**
Augment `buildImportExtractionPrompt` to pass a structured alias registry per character instead of just name + personality. Pull existing `storyCharacterAlias` records from DB. Add explicit instruction: "NEVER create a character whose name appears in the existing registry — use their ID instead."

**Change 3: Explicit correction pass after all chunks**
Add a new tool `storytelling__audit_characters` that fetches all character records and runs a focused LLM prompt: "For each character below, determine if the name field is a proper name or a description. Return corrections." Use `strict: true` tool_use with `name: { type: "string", maxLength: 50 }`.

## Architecture Recommendation (With Python Microservice)

If a Python microservice is acceptable, add GLiNER as a pre-pass:

```
Chunk text → POST /nlp/persons → ["Quinn", "Mr. Kim", "Violet"] → inject into LLM prompt as "verified_names" list
```

The LLM extraction prompt then includes:
```
## Verified Person Mentions (from NLP pre-pass)
The following names were found in the text: Quinn, Mr. Kim, Violet
Character name fields MUST use one of these exact strings (or an existing character's name). Never use a description as a name.
```

## Sources

- GLiNER: https://github.com/urchade/GLiNER
- BookNLP: https://github.com/booknlp/booknlp
- LlmLink (COLING 2025): https://aclanthology.org/2025.coling-main.751/
- LINK-KG coreference pipeline: https://arxiv.org/html/2510.26486
- Claude structured outputs docs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Claude tool use docs: https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use
- GDELT LLM entity extraction experiments: https://blog.gdeltproject.org/experiments-in-entity-extraction-using-llms-hallucination-how-a-single-apostrophe-can-change-the-results/
- LitBank dataset: https://github.com/dbamman/litbank
- Literary coreference with LLMs (ACL 2024): https://arxiv.org/html/2401.17922v1
- Explosion AI NER task overview: https://explosion.ai/_/task/ner
