# Research: NER and Coreference Resolution for Character Extraction from Conversational Text
Date: 2026-03-22

## Summary

Research into tools for extracting character entities from informal chat transcripts (Human/Assistant dialogue about personal stories). Characters are referenced by name, nickname, description, pronoun, or evolving label. The pipeline must handle ambiguous, informal, and non-standard entity references — the hardest case for traditional NLP tools.

## Prior Research
None in AI_RESEARCH/ — this is original research.

## Current Findings

---

### 1. NER Libraries: Comparison for Informal/Conversational Text

#### spaCy
- **Package:** `pip install spacy` + `python -m spacy download en_core_web_trf`
- **PyPI:** https://pypi.org/project/spacy/
- **Docs:** https://spacy.io/
- **Architecture:** Token-based pipeline with a CNN/transformer NER component. `en_core_web_trf` uses RoBERTa.
- **Speed:** Very fast on CPU; fastest of the three on large batches.
- **Accuracy on PERSON (formal text):** F1 ≈ 0.741 average across entity types (Stanza benchmark)
- **Accuracy on PERSON (ambiguous/informal):** F1 = 0.471 — worst of the group on ambiguous person names. Achieves precision = 1.0 but recall = 0.307, meaning it misses ambiguous names like "Justice" or "Hope" entirely.
- **Conversational text:** Not specifically optimized. Training data is primarily OntoNotes (news + web).
- **Node.js integration:** Via subprocess (write a Python script, call it with `child_process.spawn`), or via the unmaintained `spacy-nlp` npm package (Socket.IO bridge, not recommended for production).
- **Verdict for this use case:** Too conservative on recall for informal character references. Will miss "the guy from CIS 405" style mentions entirely (that's not spaCy's job — it's a span recognizer, not a descriptor resolver).

#### Stanza (Stanford NLP)
- **Package:** `pip install stanza` + `stanza.download('en')`
- **PyPI:** https://pypi.org/project/stanza/
- **Docs:** https://stanfordnlp.github.io/stanza/
- **Architecture:** Transformer-based (CharLM + LSTM or transformer encoder). Fine-tuned on OntoNotes + CoNLL.
- **Speed:** Slower than spaCy, GPU recommended for large-scale.
- **Accuracy on PERSON (ambiguous):** F1 = 0.870 — significantly better than spaCy on ambiguous person names.
- **Accuracy overall:** Average F1 ≈ 0.806 across entity types.
- **Conversational text:** Better than spaCy for ambiguous names due to richer contextual models. Still trained primarily on formal text.
- **Node.js integration:** Same subprocess pattern as spaCy. The `spacy-stanza` package wraps Stanza in a spaCy pipeline (https://github.com/explosion/spacy-stanza).
- **Verdict:** Better than spaCy for person name recall, but still not great on truly informal descriptors.

#### Flair
- **Package:** `pip install flair`
- **PyPI:** https://pypi.org/project/flair/
- **Docs:** https://flairnlp.github.io/
- **GitHub:** https://github.com/flairNLP/flair
- **Architecture:** Contextual string embeddings (character-level LM) stacked with word embeddings. Also supports transformer-based models (BERT, RoBERTa).
- **Speed:** Slowest of the three by default; can be optimized ~10x with batching and GPU.
- **Accuracy:** Highest of the three on formal NER benchmarks (CoNLL-03: ~93 F1 with the stacked model).
- **Conversational text:** No specific conversational benchmarks found. Contextual embeddings capture some informal variation better than pure token-level approaches.
- **Node.js integration:** Subprocess only.
- **Verdict:** Best accuracy on formal NER; still limited for informal descriptors. Slowest.

#### GLiNER (RECOMMENDED — zero-shot, flexible)
- **Package:** `pip install gliner` (v0.2.26, updated March 19, 2026 — actively maintained)
- **PyPI:** https://pypi.org/project/gliner/
- **GitHub:** https://github.com/urchade/GLiNER
- **HuggingFace:** https://huggingface.co/urchade/gliner_medium-v2.1
- **Paper (NAACL 2024):** https://aclanthology.org/2024.naacl-long.300/
- **Architecture:** Bidirectional transformer encoder (BERT-like). Entity labels are passed as input alongside text — zero-shot NER via label conditioning.
- **Key differentiator:** You specify entity types as plain-English labels at inference time. No retraining needed.
  ```python
  from gliner import GLiNER
  model = GLiNER.from_pretrained("urchade/gliner_medium-v2.1")
  entities = model.predict_entities(
      "the guy from CIS 405 showed up in grey sweatpants",
      labels=["person", "clothing description", "course reference"],
      threshold=0.5
  )
  ```
- **Speed:** Significantly faster than LLMs; runs on CPU. Parallel entity extraction (vs sequential token generation of LLMs).
- **Accuracy:** GLiNER-L achieves average F1 = 60.9 on zero-shot benchmarks, outperforming ChatGPT (47.5 F1), GoLLIE (58.0 F1), and UniNER-13B (55.6 F1).
- **Informal text limitation:** Underperforms vs UniNER on tweet/social media datasets. Known weakness on noisy text. Still the most flexible traditional approach.
- **Python ≥ 3.8 required.**
- **Node.js integration:** Subprocess only.
- **Verdict:** Best traditional NER option for this use case due to zero-shot flexibility. You can define "character", "nickname", "physical descriptor", "course code" as labels without retraining. Actively maintained.

#### FABLE (Fiction-Specific NER)
- **Model:** `SaladTechnologies/fable-base` on HuggingFace
- **HuggingFace:** https://huggingface.co/SaladTechnologies/fable-base
- **Dataset:** `SaladTechnologies/fiction-ner-750m` (750M tokens from Project Gutenberg, AO3, Internet Archive)
- **Architecture:** DeBERTa v3 fine-tuned for narrative fiction NER.
- **Entity types:** CHA (Character), LOC, FAC, OBJ, EVT, ORG, MISC
- **F1 Score:** ~0.752 on validation set (likely conservative due to annotation noise).
- **Usage:**
  ```python
  from transformers import pipeline
  pipe = pipeline("token-classification", model="SaladTechnologies/fable-base")
  result = pipe("Alice was beginning to get very tired...")
  ```
- **Limitation:** Trained on literary fiction, not informal chat. Skews toward older English literature (Project Gutenberg bias). Will not handle "the guy from CIS 405" descriptions.
- **Verdict:** Useful as a supplementary signal for named character extraction, but not the primary tool for informal conversational text.

---

### 2. Coreference Resolution Libraries

#### fastcoref (RECOMMENDED)
- **Package:** `pip install fastcoref` (v2.1.6, May 2023 — MIT license)
- **PyPI:** https://pypi.org/project/fastcoref/
- **GitHub:** https://github.com/shon-otmazgin/fastcoref
- **Paper (AACL 2022):** https://arxiv.org/abs/2209.04280
- **Two models available:**
  - `FCoref` — fast distilled model (25 seconds for 2.8K OntoNotes docs on V100 GPU)
  - `LingMessCoref` — accurate model, state-of-the-art (6 minutes for same dataset)
- **Speed comparison:** FCoref is ~14x faster than LingMess, ~29x faster than AllenNLP.
- **Usage:**
  ```python
  from fastcoref import FCoref, LingMessCoref
  model = FCoref(device='cuda:0')  # or 'cpu'
  preds = model.predict(texts=['Text here...'])
  # Returns cluster spans for all coreferring mentions
  ```
- **spaCy integration:** Provides a spaCy pipeline component.
- **Informal text:** Not explicitly benchmarked on conversational/informal text. Trained on OntoNotes (formal text). Performance on "grey sweatpants guy" = same entity as "the guy from CIS 405" is not tested.
- **LingMess note:** LingMess uses "linguistically informed multi-expert scorers" — separate scorers for different coreference phenomena. The FCoref model distills this down for speed.
- **Verdict:** Best practical coreference resolution library available. Fast, pip-installable, well-documented, actively maintained.

#### NeuralCoref (NOT RECOMMENDED — deprecated)
- **Package:** `pip install neuralcoref`
- **GitHub:** https://github.com/huggingface/neuralcoref
- **Status:** Compatible with spaCy 2.x only. spaCy is now at v3.8+. This creates a hard incompatibility — you cannot use neuralcoref with any modern spaCy model.
- **English only** — uses a pre-trained statistical model.
- **Verdict:** Do not use. Blocked by spaCy version incompatibility. Archived/unmaintained.

#### spaCy Experimental Coref
- **Package:** `pip install spacy-experimental` (v0.6.0+)
- **Docs:** https://spacy.io/api/coref
- **Blog post:** https://explosion.ai/blog/coref
- **Architecture:** Word-level coreference (O(N^2) complexity vs O(N^4) for span-level). Two-component: `CoreferenceResolver` + `SpanResolver`.
- **Model:** `en_coreference_web_trf` (RoBERTa + LSTM, trained on OntoNotes)
- **Status:** EXPERIMENTAL — not in spaCy core. Actively developed but not production-stable.
- **Limitations:**
  - Non-overlapping spans only — cannot handle split antecedents
  - Trained on OntoNotes (formal text) — significant domain sensitivity
  - Does not handle informal discourse markers or compound noun modifiers
  - Heavy GPU memory footprint
- **Verdict:** Interesting architecture, but experimental status and formal-text training make it risky for informal conversational input.

#### AllenNLP Coref (NOT RECOMMENDED — unmaintained)
- **Status:** AllenNLP was sunset by AI2 in 2023. The coreference model is no longer actively maintained.
- **Speed:** 12 minutes for 2.8K docs — slowest of all options.
- **Verdict:** Do not use.

#### s2e-coref (NOT RECOMMENDED — research only)
- **GitHub:** https://github.com/yuvalkirstain/s2e-coref
- **Status:** Last commit April 2021. 7 open issues, no pip package. Requires paid OntoNotes 5.0 corpus for training.
- **Verdict:** Research artifact only. Not usable as a library.

#### BookNLP (RECOMMENDED for narrative character coreference)
- **Package:** `pip install booknlp` + `python -m spacy download en_core_web_sm`
- **GitHub:** https://github.com/booknlp/booknlp
- **Tutorial:** https://booknlp.pythonhumanities.com/01_intro.html
- **Architecture:** Fine-tuned BERT models. Trained on LitBank and PreCo for coreference; ~500 contemporary books for overall pipeline.
- **What it does specifically:**
  - Named entity recognition (people, facilities, locations, geo-political entities, organizations, vehicles)
  - Character name clustering: "Tom", "Tom Sawyer", "Mr. Sawyer" → single entity `TOM_SAWYER`
  - Coreference resolution: links pronouns and common entity mentions (e.g., "the boy") to named entities
  - Quotation speaker attribution
  - Referential gender inference from pronouns
- **Two models:** `big` (GPU/multi-core) and `small` (personal computers)
- **Known limitation:** "Accurate coreference at the scale of a book-length document is still an open research problem." Full coreference incorrectly merges distinct entities at scale.
- **Research papers using it (2024-2025):** Multiple 2024 papers use BookNLP + FastCoref for character identification in narrative texts.
- **Verdict:** Most purpose-built tool for narrative character extraction. Handles "Tom" → "Mr. Sawyer" clustering natively. Does not handle informal descriptor-based mentions ("grey sweatpants") without additional work.

---

### 3. Character Identification in Narrative/Dialogue Text: Specialized Models

#### The FastCoref + BookNLP Pipeline (Evidence-Based Best Practice)
A 2025 dataset paper (Nature Scientific Data) building narrative dialogue datasets used:
- FastCoref for coreference resolution (masked dialogue processing)
- BookNLP for enhanced entity resolution
This combination is the current research community standard for narrative character extraction.

#### Fiction-NER-750M + FABLE
- The `SaladTechnologies/fiction-ner-750m` dataset explicitly addresses the gap: "Many named entity recognition models perform poorly on narrative fiction, and entity categories often don't align with types important in stories — there are subtle differences between a person and a character."
- The trained FABLE model uses the `CHA` (Character) entity type specifically.
- Limitation: training data is literary fiction, not informal chat.

#### LLM-Based Extraction (HIGH CONFIDENCE for the informal text problem)
The benchmark (arXiv 2509.12098) is decisive:
- LLMs: average F1 = 0.923 on PERSON recognition with ambiguous entities
- Traditional tools: average F1 = 0.692
- Best LLMs (Gemini-1.5-flash, DeepSeek-V3): F1 = 0.960 on PERSON
- spaCy: F1 = 0.471 (missing ambiguous names entirely)

For informal chat transcripts with non-standard character references, an LLM-based extraction pass (structured output prompt) outperforms all traditional NER approaches significantly on the hard cases.

**Practical approach using Claude/GPT:**
```typescript
const prompt = `Extract all characters mentioned in this conversation transcript.
For each character, list:
- All names/nicknames used
- All descriptive references ("the guy from CIS 405", "grey sweatpants")
- Pronouns used
Group references that clearly refer to the same person.

Transcript:
${transcript}

Return as JSON: { characters: [{ id, names, descriptors, pronouns }] }`;
```

---

### 4. Embedding Similarity for Entity Mention Clustering

#### The Approach
When traditional NER identifies spans but coreference resolution fails to link "the expander" to "grey sweatpants guy", embedding-based clustering can bridge the gap:

1. Extract all candidate character mentions (named entities + descriptive noun phrases)
2. Embed each mention using a sentence encoder
3. Cluster mentions using cosine similarity threshold

#### Recommended Embedding Tools

**sentence-transformers (Python)**
- `pip install sentence-transformers`
- Models: `all-MiniLM-L6-v2` (fast, 384-dim), `all-mpnet-base-v2` (higher quality)
- The project already uses `all-MiniLM-L6-v2` via `@harness/vector-search`

**Cosine Similarity Threshold**
- Research finding: best results at threshold = 0.7 with linear decay factor of 0.03 for mention clustering (from MDPI hybrid pipeline paper)
- BERT span embeddings with gender/number/animacy penalty coefficient when features don't match

**Practical limitation for the use case:** "the guy from CIS 405" and "grey sweatpants" have very low cosine similarity because they describe the same entity differently with no lexical overlap. Pure embedding similarity will not reliably link these. This requires coreference resolution (context-dependent) or LLM extraction.

#### JavaScript/npm Options for Pure-JS Pipelines
These are much weaker than Python alternatives but avoid subprocess overhead:
- **compromise.js** — lightweight, English-only, detects people/places/orgs. No model backing — heuristic. Works for named entities only.
- **winkNLP** — fast pipeline with NER. Better than compromise for production JS.
- **@nlpjs/ner** — part of NLP.js, entity extraction with pattern matching.
- **Verdict:** None of these handle informal descriptors or coreference. Suitable only for simple named entity extraction as a first pass.

---

### 5. Node.js Integration Patterns for Python NLP Tools

Since the pipeline is TypeScript/Node.js:

**Option A: Python subprocess (recommended)**
```typescript
import { spawn } from "child_process";

const result = await new Promise<string>((resolve, reject) => {
  const proc = spawn("python3", ["/path/to/extract_characters.py", "--input", inputPath]);
  let output = "";
  proc.stdout.on("data", (chunk) => { output += chunk; });
  proc.on("close", (code) => code === 0 ? resolve(output) : reject(new Error(`exit ${code}`)));
});
return JSON.parse(result);
```

**Option B: Python FastAPI microservice**
Wrap the NLP pipeline in a FastAPI server; call via HTTP from Node.js. Better for warm models (avoids model loading overhead per request).

**Option C: Direct LLM API call (no Python needed)**
For the character extraction task specifically, calling Claude/GPT with a structured output prompt eliminates all Python dependency. Given the benchmark showing LLMs outperform traditional NER by 23 F1 points on ambiguous persons, this may be the best approach for informal text.

---

## Key Takeaways

1. **For informal conversational text, LLM-based extraction wins decisively.** The F1 gap (0.923 vs 0.692) is too large to ignore. Traditional NER tools were not designed for "the guy from CIS 405".

2. **GLiNER is the best traditional NER option** if you want to avoid LLM API costs. Zero-shot label flexibility means you can define "physical descriptor" and "course reference" as entity types without retraining. Actively maintained (v0.2.26, March 2026).

3. **FastCoref is the best coreference library** — pip-installable, fast, well-maintained, two model options (speed vs accuracy). LingMess mode for best accuracy.

4. **BookNLP is the best purpose-built narrative pipeline** — handles character name clustering natively ("Tom" → "Mr. Sawyer"). Best fit if input resembles literary prose more than chat.

5. **NeuralCoref and AllenNLP are dead** — do not use.

6. **s2e-coref is a research artifact** — no pip package, last commit 2021.

7. **spaCy's experimental coref** is promising architecture but domain-sensitive and not production-stable.

8. **Recommended pipeline for the storytelling use case:**
   - Pass A: LLM (Claude) structured extraction → JSON list of character mentions with clusters
   - Pass B (optional validation): GLiNER or BookNLP to catch missed named entities
   - Coreference: FastCoref (FCoref mode for speed, LingMessCoref for accuracy)
   - Embedding clustering: sentence-transformers for unresolved descriptors

9. **All serious NLP tools are Python** — integrate via subprocess or HTTP microservice from the Node.js pipeline.

---

## Sources

- GLiNER GitHub: https://github.com/urchade/GLiNER
- GLiNER PyPI: https://pypi.org/project/gliner/
- GLiNER NAACL 2024 paper: https://aclanthology.org/2024.naacl-long.300/
- FastCoref GitHub: https://github.com/shon-otmazgin/fastcoref
- FastCoref PyPI: https://pypi.org/project/fastcoref/
- FastCoref paper (arXiv): https://arxiv.org/abs/2209.04280
- LingMess GitHub: https://github.com/shon-otmazgin/lingmess-coref
- NeuralCoref GitHub (archived): https://github.com/huggingface/neuralcoref
- BookNLP GitHub: https://github.com/booknlp/booknlp
- BookNLP tutorial: https://booknlp.pythonhumanities.com/01_intro.html
- FABLE model: https://huggingface.co/SaladTechnologies/fable-base
- Fiction-NER-750M dataset: https://huggingface.co/datasets/SaladTechnologies/fiction-ner-750m
- spaCy coref (experimental): https://spacy.io/api/coref
- spaCy experimental coref blog: https://explosion.ai/blog/coref
- s2e-coref GitHub: https://github.com/yuvalkirstain/s2e-coref
- NER ambiguity benchmark (arXiv 2509.12098): https://arxiv.org/html/2509.12098v1
- Coreference resolution overview (Neurosys): https://neurosys.com/blog/popular-frameworks-coreference-resolution
- FastCoref + BookNLP narrative pipeline (Nature Scientific Data 2025): https://www.nature.com/articles/s41597-026-06891-3
- Hybrid neuro-symbolic coreference pipeline (MDPI): https://www.mdpi.com/2078-2489/16/7/529
