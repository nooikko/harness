# Storytelling Plugin — Implementation Plan

## Problem

Roleplay/storytelling responses from Claude are flat markdown. When 10+ exchanges stack with mixed dialogue, action beats, internal thoughts, similes, and narration, it all blends together. Need:

1. Visual structure — differentiate dialogue from narration from thoughts from actions
2. Speaker identity — clear labels for who is speaking, with consistent colors
3. Character knowledge consistency — "does she know about last Tuesday?"
4. Emergent character tracking — characters are introduced by the AI, not pre-defined by the user
5. OOC convention — user already uses `//` prefix for out-of-story meta-communication

## Research Sources

- `AI_RESEARCH/2026-03-17-roleplay-narrative-ui-rendering-patterns.md` — full UI research
- SillyTavern italic/quote color system, NovelAI dialogue highlighting, Ren'Py ADV namebox pattern, Tupperbox per-character identity splitting, chat fiction app color palettes

## Design Decisions

### Markdown Conventions + Enhanced Renderer (not structured JSON)

Claude writes using lightweight narrative conventions (already natural to it):
- `**NAME** *(emotion)*: "dialogue"` — dialogue with attribution
- `*Italic paragraphs*` — action/description
- `> Blockquotes` — internal thoughts
- `---` — scene breaks
- Undecorated paragraphs — narration

These are valid markdown that render fine without the enhanced renderer but look great with it. This preserves Claude's natural writing quality.

### Stories as a First-Class Entity (Parallel to Projects)

Stories are NOT a thread mode toggle. They are a **top-level entity** like Projects, with their own UI, data model, and navigation.

```
Project (existing)              Story (new, parallel)
-----------------------         -----------------------
Has threads                     Has threads (chapters/scenes)
Has memory (project-level)      Has characters (story-level)
Has instructions                Has premise/setting/rules
Thread inherits projectId       Thread inherits storyId
```

Characters live at the **story level**, not the thread level. A story has **one continuous narrative path** but may span multiple threads for practical reasons — context window limits, session timeouts, picking up the next day, speed, etc. Threads within a story are continuation segments (like chapters or sessions), NOT branching paths. Characters persist and evolve seamlessly across all threads. The user shouldn't have to think about thread boundaries — the Story is the continuity container.

```
Story: "The Elena Arc"
  ├── Thread 1 (messages 1-50, context filled up)
  ├── Thread 2 (continued next day)
  └── Thread 3 (still going)

  Characters: Elena, Marcus, the cheerleaders, Mikenze
  All persist across all three threads seamlessly.
```

### Key Design Decisions

1. **Characters do NOT move across stories.** Each story has its own cast. If the user wants a character in a new story, they port them manually.

2. **Stories are parallel to Projects, separate hierarchy.** A thread belongs to either a Story OR a Project (or neither), not both. They are peer entities at the same navigation level.

3. **Thread continuation gets an auto-generated recap.** When starting a new thread in a story, the system generates a recap that combines:
   - Character state summaries (personality, current emotional state, what's changed)
   - Recent pivotal moments from StoryMoment records (with per-character perspectives)
   - Current scene setup (from the last few messages of the previous thread)
   - Emotional temperature and direction

Example of what an auto-generated recap looks like (injected into the first prompt of a new story thread):

```
# Story Continuation — "The Elena Arc"
## Thread 3 (continuing from Thread 2)

## Cast — Current State

### Sam
Personality: Guarded, tall, lean. Walls up for years. Doesn't let anyone in.
Recent shift: Something cracked open over the past few days. Learning that intimacy doesn't have to be hard.
Key moments: Said "don't leave" while crying on a bathroom floor. Held {{user}} all night.
Current state: Trying to initiate something but doesn't have the words. Never been the one to reach first.

### [Other active characters...]

## Where We Left Off

Setting: Alone in the kitchen. The others are in the other room.
Scene: Sam is looking at {{user}} like she wants something but doesn't know how to ask for it.
Tension: She's trying to initiate but is clumsy and unsure. Wanting.

## Continue from here.
```

**Recap generation:** Triggered as a **blocking server action** during "New Thread" creation (not a plugin hook). The `create-story-thread.ts` server action:
1. Loads all `StoryCharacter` records for the story (current state)
2. Loads recent `StoryMoment` records with `CharacterInMoment` perspectives
3. Loads last 10-20 messages from the most recent thread (scene context)
4. Loads the story's premise/setting and `currentScene`
5. Calls Haiku to generate the recap (blocking, ~2-3 seconds)
6. Creates the new Thread with `storyId`
7. Creates a `kind: 'recap'` Message as the first message in the thread
8. The recap message is then loaded by the context plugin's history injection on the first real message

The user sees a brief loading state during thread creation. This is acceptable — they're switching context and expect a moment of setup.

### Characters Are Emergent

Characters are NOT defined upfront. The AI introduces them during conversation. The system detects and tracks them automatically via `onAfterInvoke` Haiku analysis (same pattern as episodic memory scoring).

### Conversational Character Management

User manages characters 90% through `//` OOC messages:
- `// make Elena more assertive`
- `// the color of Character 1 and Character 7 are too close together`
- `// Elena doesn't know about Marcus yet`
- `// rename "the cheerleader" to Mikenze`

The agent can also manage characters directly via MCP tools:
- `storytelling__update_character` — modify appearance, personality, mannerisms, motives, relationships, status
- `storytelling__record_moment` — record a significant event with per-character perspectives
- `storytelling__list_cast` — retrieve active characters for a story

The character sidebar is a **read view with light inline editing**, not a creation form.

### Architecture: Parallel to Identity Plugin

```
Identity Plugin (existing)         Storytelling Plugin (new)
-------------------------------    --------------------------------
1 Agent per thread                 N Characters per story
Agent.soul, .identity              Character.appearance, .personality, .mannerisms
AgentMemory (episodic)             StoryMoment + CharacterInMoment (per-character POV)
onBeforeInvoke: inject soul        onBeforeInvoke: inject cast sheet + locations
onAfterInvoke: score + write       onAfterInvoke: extract chars + moments + locations
Project scope                      Story scope (across all story threads)
```

---

## Phase 1: Narrative Formatting + OOC Support

**Goal:** Immediate visual improvement. No schema changes.

### 1a. Enhanced Narrative Markdown Renderer

New component `narrative-content.tsx` that extends `markdown-content.tsx` with pattern recognition:

| Pattern | Type | Visual Treatment |
|---------|------|-----------------|
| `**NAME** *(emotion)*: "dialogue"` | Dialogue | Speaker badge (colored), emotion tag, styled quote |
| `**NAME**: "dialogue"` | Dialogue | Speaker badge, styled quote |
| `*Italic paragraph*` | Action/description | Indented, muted color, different font style |
| `> Blockquote` | Internal thought | Thought bubble styling, lighter, italic |
| `---` | Scene break | Decorative divider (not just `<hr>`) |
| Undecorated paragraph | Narration | Standard prose styling |

Visual patterns from research:
- **Pattern A (SillyTavern):** Distinct colors for italic text (action) vs quoted text (dialogue)
- **Pattern B (Ren'Py ADV):** Character name in a colored "namebox" overlapping top-left of message
- **Pattern C (chat fiction):** `border-left: 3px solid [character-color]` on dialogue blocks

Speaker colors: deterministic hash from character name → one of 8 preset palette colors. No manual assignment needed.

Files:
- `apps/web/src/app/(chat)/chat/_components/narrative-content.tsx`
- `apps/web/src/app/(chat)/chat/_components/_helpers/parse-narrative-blocks.ts`
- `apps/web/src/app/(chat)/chat/_components/_helpers/character-color-map.ts`
- Modify `message-item.tsx` to use `NarrativeContent` when thread is in storytelling mode

### 1b. OOC `//` Convention

- Detect `//` prefixed user messages in renderer → style as "director's note" (muted, small, system-message aesthetic)
- In the storytelling plugin's `onBeforeInvoke`, wrap `//` content:
  ```
  [OUT OF CHARACTER — Author direction, not in-story]
  {content}
  [END OOC]
  ```
- Claude continues the story after acknowledging the direction

### 1c. Thread Storytelling Mode

Phase 1 (no schema changes): use `Thread.metadata` JSON field with `{ storytelling: true }` as a temporary toggle. The `NarrativeContent` renderer activates when this flag is set.

Phase 2 (after Story model exists): a thread with `storyId != null` automatically gets storytelling mode. The metadata toggle becomes unnecessary for story threads but can remain for standalone storytelling threads that don't belong to a Story.

Plugin: `@harness/plugin-storytelling` with `onBeforeInvoke` hook.

Files:
- `packages/plugins/storytelling/` — new plugin package
- `apps/orchestrator/src/plugin-registry/index.ts` — register plugin

### 1d. Formatting Instructions (injected by plugin)

The `onBeforeInvoke` injection tells Claude how to format narrative:

```
# Storytelling Format

Use these conventions in your narrative responses:

**Dialogue:** Write character speech as `**CHARACTER NAME**: "dialogue"` or `**CHARACTER NAME** *(stage direction)*: "dialogue"`
**Actions/Description:** Wrap action beats and physical descriptions in *italics*
**Internal thoughts:** Use > blockquotes for internal monologue
**Scene breaks:** Use --- for scene transitions
**Narration:** Write scene-setting and exposition as plain text

Example:
**ELENA** *(almost to herself)*: "Take what I need."

*She pauses, turning the phrase over like a smooth stone in her palm.*

> I shouldn't want this. But I do.

**ELENA**: "Ok.. I will."

---

The room shifts. Shadows lengthen as the last light drains from the window.
```

---

## Phase 2: Emergent Character Detection + Knowledge Tracking

**Goal:** Characters are automatically detected, tracked, and their knowledge state maintained.

### 2a. Schema

```prisma
model Story {
  id          String   @id @default(cuid())
  name          String
  premise       String?  @db.Text  // setting, rules, genre
  storyTime     String?            // current in-story time: "November 13th, late afternoon"
  currentScene  Json?              // { characters: ["Sam","Elena"], location: "Kitchen" }
  agentId       String?
  agent       Agent?   @relation(fields: [agentId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  threads     Thread[]           // continuation segments
  characters  StoryCharacter[]
  moments     StoryMoment[]
  locations   StoryLocation[]

  @@index([agentId])
}

model StoryCharacter {
  id            String   @id @default(cuid())
  storyId       String
  story         Story    @relation(fields: [storyId], references: [id], onDelete: Cascade)
  name          String
  aliases       String[] // "Mikenze", "the cheerleader", "Kenz" — GIN index in migration for array contains lookup
  appearance    String?  @db.Text  // physical: "Tall, lean, sharp jawline, dark hair always tied back"
  personality   String?  @db.Text  // behavioral: "Guarded, deliberate with words, quiet intensity"
  mannerisms    String?  @db.Text  // how they move/speak: "Pauses before answering, avoids eye contact when vulnerable"
  motives       String?  @db.Text
  backstory     String?  @db.Text  // what's known about their past
  relationships String?  @db.Text  // to other characters
  color         String?  // hex color override (null = auto from palette)
  status        String   @default("active") // active, departed, deceased
  firstSeenAt   DateTime @default(now())
  updatedAt     DateTime @updatedAt
  moments       CharacterInMoment[]

  @@unique([storyId, name])
  @@index([storyId, status])
}

// Named locations in the story — spatial world model with containment and relationships
model StoryLocation {
  id          String   @id @default(cuid())
  storyId     String
  story       Story    @relation(fields: [storyId], references: [id], onDelete: Cascade)
  name        String   // "Rebecca's condo"
  description String?  @db.Text  // "Small two-bedroom, warm lighting, herbs on the windowsill"
  parentId    String?             // containment: kitchen.parentId → condo.id
  parent      StoryLocation?  @relation("LocationContainment", fields: [parentId], references: [id])
  children    StoryLocation[] @relation("LocationContainment")
  moments       StoryMoment[]  // moments that occurred at this location
  relationsFrom LocationRelationship[] @relation("LocationFrom")
  relationsTo   LocationRelationship[] @relation("LocationTo")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([storyId, name])
  @@index([storyId])
  @@index([parentId])
}

// Spatial relationships between locations (not containment — that's the parent FK)
model LocationRelationship {
  id          String        @id @default(cuid())
  fromId      String
  from        StoryLocation @relation("LocationFrom", fields: [fromId], references: [id], onDelete: Cascade)
  toId        String
  to          StoryLocation @relation("LocationTo", fields: [toId], references: [id], onDelete: Cascade)
  distance    String?       // "about 2 blocks", "20 minute drive", "across the hall"
  direction   String?       // "north", "upstairs", "down the street"
  notes       String?       // "shortcut through the park"

  @@unique([fromId, toId])
}

// A significant scene/event in the story — rich enough to reconstruct as a flashback
model StoryMoment {
  id          String         @id @default(cuid())
  storyId     String
  story       Story          @relation(fields: [storyId], references: [id], onDelete: Cascade)
  summary     String         @db.Text  // "Sam had her first kiss with Elena"
  description String?        @db.Text  // rich scene description for flashback reconstruction
  storyTime   String?                  // in-story datetime: "November 13th, mid-afternoon"
  locationId  String?                  // FK to StoryLocation — resolved by Haiku at extraction time
  location    StoryLocation? @relation(fields: [locationId], references: [id], onDelete: SetNull)
  kind        String                   // milestone, revelation, conflict, intimacy, betrayal, loss, discovery
  importance  Int            @default(5)
  messageId   String?                  // FK to Message — source message this was extracted from
  message     Message?       @relation(fields: [messageId], references: [id], onDelete: SetNull)
  createdAt   DateTime       @default(now())
  characters  CharacterInMoment[]

  @@index([storyId, createdAt])
  @@index([storyId, importance])
  @@index([locationId])
}

// Per-character perspective on a moment — enables flashbacks from any character's POV
model CharacterInMoment {
  id              String          @id @default(cuid())
  characterId     String?         // nullable — SetNull on character delete preserves the moment record
  character       StoryCharacter? @relation(fields: [characterId], references: [id], onDelete: SetNull)
  characterName   String          // denormalized — survives character deletion for display
  momentId        String
  moment          StoryMoment     @relation(fields: [momentId], references: [id], onDelete: Cascade)
  role            String          // initiator, recipient, witness, mentioned, absent
  perspective     String?         @db.Text  // "Terrified but couldn't stop herself"
  emotionalImpact String?         @db.Text  // "Breakthrough — realized intimacy can feel safe"
  knowledgeGained String?         @db.Text  // "Now knows Elena feels the same way"

  @@unique([characterId, momentId])
  @@index([characterId])
  @@index([momentId])
}
```

Thread gets a new optional FK (peer to projectId, not nested under it):
```prisma
model Thread {
  // ... existing fields
  storyId   String?
  story     Story?  @relation(fields: [storyId], references: [id], onDelete: SetNull)
  // projectId and storyId are mutually exclusive — enforced at application level
  // via Prisma $extends middleware that rejects writes with both set
}
```

Agent model needs the reverse relation:
```prisma
model Agent {
  // ... existing fields
  stories   Story[]
}
```

**Mutual exclusivity enforcement:** Prisma doesn't support CHECK constraints. Use a `$extends` middleware on the database package that rejects any `thread.create` or `thread.update` where both `storyId` and `projectId` are non-null. This catches all code paths (web actions, plugins, cron lazy creation, delegation).

When a thread belongs to a Story, it automatically gets storytelling mode. The plugin resolves `thread.storyId` → loads all characters for that story, regardless of which thread they were introduced in. Starting a new thread in a story triggers the auto-recap generation (Haiku summarization of character state + recent events + scene context from the previous thread).

### 2b. Story State Extraction (onAfterInvoke) — BLOCKING, not fire-and-forget

**Why blocking:** Fire-and-forget creates race conditions — if the user sends another message before extraction completes, the next `onBeforeInvoke` reads stale `currentScene` and injects the wrong character tiers. Unlike episodic memory scoring (where missing one write is invisible), stale scene data directly degrades narrative consistency every turn. The extraction is fast (Haiku, 1-2s) and the user is reading the response during this time anyway.

**Data access:** `onAfterInvoke` receives `(threadId, result: InvokeResult)`. `InvokeResult` contains `output` (the assistant's response text) but NOT conversation history. The assistant message has NOT been persisted to the DB yet at this point (that happens in `sendToThread` after `handleMessage` returns). So the extraction must:
1. Query DB for recent user messages: `ctx.db.message.findMany({ where: { threadId, role: 'user' }, orderBy: { createdAt: 'desc' }, take: 2 })`
2. Use `result.output` for the current assistant response (not yet in DB)
3. Combine these as the "latest exchange" for the extraction prompt

**Dedup guard:** 60-second duplicate guard keyed on `storyId`, same pattern as summarization plugin. Prevents double-extraction on retries or delegation.

After each AI response in storytelling threads, a **blocking** Haiku call extracts three things:

**1. Characters** — new introductions + updates to existing cast
**2. Moments** — significant events with per-character perspectives
**3. Locations** — new named places with descriptions + spatial relationships

```
Given:
- Known characters: [cast JSON — names + IDs + current state]
- Known locations: [locations JSON — names + IDs + parent hierarchy]
- Story time context: [last known story time]
- Latest exchange: [last 2-3 messages, assembled from DB query + result.output]

Extract:

1. CHARACTERS
   - New characters introduced (name, description, personality, relationships)
   - Updates to existing characters (personality shifts, motive changes, relationship changes)
   - Alias mappings ("the cheerleader" → existing character Mikenze)

2. MOMENTS (only for significant events — not every line of dialogue)
   - summary: "Sam had her first kiss with Elena"
   - description: Rich enough to reconstruct as a flashback scene
   - storyTime: "November 13th, mid-afternoon" (track story-internal time)
   - locationId: ID of an existing StoryLocation, OR null + new location name/description
   - kind: milestone | revelation | conflict | intimacy | betrayal | loss | discovery
   - importance: 1-10
   - characters_involved: [
       { name: "Sam", role: "initiator", perspective: "Terrified but couldn't stop herself",
         emotionalImpact: "Realized intimacy can feel safe", knowledgeGained: "Elena feels the same" },
       { name: "Elena", role: "recipient", perspective: "Surprised but held still",
         emotionalImpact: "Felt trusted for the first time", knowledgeGained: null }
     ]

3. LOCATIONS
   - New named places with descriptions and parentId (containment)
   - Updates to known locations (new details revealed)
   - Spatial relationships between locations (distance, direction)

4. SCENE UPDATE
   - characters: [names of characters currently present]
   - location: locationId of current scene location
   - storyTime: current in-story time

Return as JSON.
```

The key insight: moments are **multi-character** with per-character perspectives. When any character involved needs to recall this moment later, the AI gets their specific perspective and emotional context — enabling accurate flashbacks from any POV.

**Location resolution:** Haiku receives the existing location list with IDs and names. It returns `locationId` for known locations or `null` + a new location name/description for unknown ones. This eliminates the fuzzy-matching problem ("Kitchen of Rebecca's condo" vs "Rebecca's kitchen") — Haiku resolves the reference at extraction time.

**Scene update validation:** The `currentScene` JSON is validated with a Zod schema on write:
```typescript
const CurrentSceneSchema = z.object({
  characters: z.array(z.string()),
  location: z.string().nullable(),
  storyTime: z.string().nullable(),
});
```
Falls back to `null` on validation failure (no scene data = inject all active characters at Tier 2).

### 2c. Story State Injection (onBeforeInvoke)

When storytelling mode is active, inject active cast + recent moments + locations into prompt:

```
# Story State

## Active Cast

### Sam
Appearance: Tall, lean, sharp jawline, dark hair always tied back
Personality: Guarded, walls up for years. Learning to let people in.
Mannerisms: Pauses before answering, avoids eye contact when vulnerable, fidgets with her sleeves
Motives: Wants connection but fears vulnerability
Backstory: Left home at 17, doesn't talk about her family
Relationships: Growing intimate with {{user}}, protective of the group
Key moments (Sam's perspective):
  - Nov 13, mid-afternoon @ Rebecca's kitchen: Had her first kiss with Elena.
    "Terrified but couldn't stop herself. First time she initiated."
    Impact: Realized intimacy can feel safe.
  - Nov 12, late night @ the bathroom: Broke down crying on the floor, said "don't leave."
    Impact: First time she asked for help.
Knows: Elena feels the same way, Rebecca's history
Does NOT know: Marcus is back in town

### Elena
Appearance: Shorter, warm brown eyes, always wearing earth tones
Personality: Patient, observant, steady presence
Mannerisms: Holds eye contact, speaks softly, touches people's arms when comforting
Key moments (Elena's perspective):
  - Nov 13, mid-afternoon @ Rebecca's kitchen: Sam kissed her.
    "Surprised but held still. Let Sam come to her."
    Impact: Felt trusted for the first time.
Knows: Sam's walls are coming down
Does NOT know: Sam's full backstory

## Known Locations
- Rebecca's condo: Small two-bedroom in the arts district, warm lighting, cluttered kitchen with herbs on the windowsill
- The bathroom: Cramped, tile floor, harsh fluorescent light

## Story Time: November 13th, late afternoon
```

### Prompt Budget: Tiered Character Injection

A fully detailed character costs 700-1300 tokens. Injecting all characters at full detail is prohibitive. Instead, use tiered injection based on scene presence:

**Tier 1 — In-Scene (full detail, ~1000-1300 tokens each)**
Characters present in the current scene (detected from last 2-3 messages). Get everything: appearance, personality, mannerisms, motives, backstory, relationships, top 5 moments with their perspective, knowledge boundaries.
Typically 2-3 characters. ~2,000-4,000 tokens.

**Tier 2 — Recently Active (brief summary, ~50 tokens each)**
Characters who appeared in the last ~10 messages but aren't in the current scene. One-liner: name + core trait + current state.
```
- Rebecca: Warm, maternal energy. In the other room with the group.
- Marcus: Calculating charm. Last seen leaving the building.
```
Typically 3-5 characters. ~250 tokens.

**Tier 3 — Background Cast (name only, ~20 tokens total)**
Everyone else with status "active". Just names so Claude knows they exist.
```
Background: Jordan, Mikenze, Coach Davis, "the twins"
```

**Tier 4 — On-Demand via MCP Tool**
The AI calls `storytelling__get_character(name)` to pull full details for any character at any time. If Marcus suddenly walks into the scene, the AI loads his full profile before writing his dialogue — no need to pre-load every character.

**Total prompt budget: ~2,500-4,500 tokens** instead of 10,000+.

**Scene detection:** The `onAfterInvoke` extraction pass tracks who is currently present. A `Story.currentScene` JSON field stores: `{ characters: ["Sam", "Elena"], location: "Kitchen of Rebecca's condo", storyTime: "November 13th, late afternoon" }`. Updated after each response.

**Character knowledge boundaries:** The `knowledgeGained` and absence-from-moments tracking ensure Claude maintains consistency. If Sam doesn't know Marcus is back, Claude won't write Sam reacting to that information. The Tier 1 injection explicitly includes "Does NOT know" for in-scene characters.

### 2d. storyId Resolution + Caching

`PluginToolMeta` provides `threadId` but not `storyId`. Resolve once in `onBeforeInvoke` and cache:

```typescript
// Closure-scoped cache in register()
const storyCache = new Map<string, string | null>(); // threadId → storyId

// In onBeforeInvoke:
const thread = await ctx.db.thread.findUnique({ where: { id: threadId }, select: { storyId: true } });
storyCache.set(threadId, thread?.storyId ?? null);

// In tool handlers:
const storyId = storyCache.get(meta.threadId);
if (!storyId) return "This thread is not part of a story.";
```

Same pattern as the identity plugin's agent cache. All 6 MCP tools use this instead of individual DB queries.

### 2e. OOC Character Commands

**Interception approach:** Use `onMessage` hook (fires before `onBeforeInvoke`) to detect `//` prefixed messages. If the message matches a known command pattern, execute the DB write and store a flag in a closure-scoped set (`handledOocCommands`). Then in `onBeforeInvoke`, check the flag — if this message was a handled command, inject "The author just [action]. Continue the story." instead of the raw `//` text. Unrecognized `//` messages are wrapped in OOC tags in `onBeforeInvoke`.

The plugin intercepts `//` messages and handles character-management commands directly:

| Command | Action |
|---------|--------|
| `// rename "the cheerleader" to Mikenze` | Update StoryCharacter.name, add old name as alias |
| `// Elena doesn't know about Marcus yet` | Update knowledge boundaries (remove from knowledgeGained) |
| `// make Elena more assertive` | Update StoryCharacter.personality |
| `// remove Marcus from the story` | Set StoryCharacter.status = 'departed' |
| `// the colors of Elena and Marcus are too close` | Reassign one character's color |
| `// it's now the next morning` | Advance story time |
| `// we're at the coffee shop now` | Create/reference StoryLocation |

Unrecognized `//` commands pass through to Claude as regular OOC direction.

### 2e. MCP Tools

The storytelling plugin exposes tools so the agent can manage story state directly:

| Tool | Purpose |
|------|---------|
| `storytelling__update_character` | Modify personality, motives, relationships, status |
| `storytelling__record_moment` | Record a significant event with per-character perspectives |
| `storytelling__advance_time` | Update story-internal time |
| `storytelling__add_location` | Create or update a named location |
| `storytelling__character_knowledge` | Query what a character knows/doesn't know |
| `storytelling__cast_summary` | Get current state of all active characters |

These tools let the agent proactively manage state — e.g., after writing a life-changing scene, it calls `record_moment` to capture the event with each character's perspective.

---

## Phase 3: Story UI + Character Sidebar

**Goal:** Story as a top-level navigation item (like Projects). Character browser as a pullout panel.

### 3a. Story Navigation

- `/stories` route — list all stories (parallel to `/chat/projects`)
- `/stories/[id]` — story hub: premise, thread list, character overview
- "New Thread" button on story hub → creates thread with `storyId`, auto-generates recap
- Story appears in sidebar navigation at the same level as Projects
- Thread list within a story shows continuation order (Thread 1, 2, 3...)

### 3b. Character Pullout Panel

- Toggle button in chat header when viewing a story thread (cast icon)
- Slides out from right side of chat area
- Shows: character name + color dot + one-line description + status badge
- Click to expand: personality, motives, relationships, event timeline
- Inline edit: click any field to modify (saves to StoryCharacter)
- Character count badge on the toggle button

### 3c. Moment Timeline per Character

- Chronological list of StoryMoments this character participated in
- Each moment: icon (by kind) + summary + story time + location
- Shows this character's perspective and emotional impact
- Other characters involved shown as linked badges
- Filterable by kind (milestone, revelation, conflict, intimacy, etc.)
- "What does this character know?" view: aggregated `knowledgeGained` across all moments
- "What doesn't this character know?" view: moments they have `role: absent` for

### 3d. Relationship Map (stretch)

- Simple graph view: characters as nodes, relationships as labeled edges
- Auto-generated from `relationships` field across all characters
- Visual indicator of relationship quality (ally/enemy/neutral/romantic)

Files:
- `apps/web/src/app/(chat)/stories/` — story hub pages
- `apps/web/src/app/(chat)/chat/_components/character-sidebar.tsx`
- `apps/web/src/app/(chat)/chat/_components/_helpers/use-story-characters.ts`
- `apps/web/src/app/(chat)/chat/_actions/list-story-characters.ts`
- `apps/web/src/app/(chat)/chat/_actions/update-story-character.ts`
- `apps/web/src/app/(chat)/chat/_actions/create-story-thread.ts` — creates thread + generates recap

---

## Phase 4: Advanced Features

### 4a. Multi-Character Split Rendering (Tupperbox Pattern)

When an AI response contains dialogue from multiple characters, parse and render as separate visual blocks, each with their own name header + color accent. A single assistant message becomes visually multiple "speakers."

### 4b. Retrospective Enhancement

"Enhance formatting" button on existing flat-text messages. Uses Haiku to classify paragraphs and apply narrative structure to old responses.

### 4c. Story Export

Compile a storytelling thread into a formatted document:
- Character list with final state
- Formatted narrative with proper typography
- Event timeline / character arc summary

### 4d. Display Mode Toggle (SillyTavern-inspired)

Three rendering modes:
- **Chat** — bubbles with character colors (default)
- **Document** — flowing prose column, minimal chrome (reading mode)
- **Script** — screenplay-style formatting (character cues, stage directions)

---

## Open Design Decisions

### Plugin Ordering

The storytelling plugin uses `onBeforeInvoke` (inject cast + formatting instructions) and `onAfterInvoke` (extract state). Where does it sit in the chain?

```
identityPlugin,       // MUST be first — agent soul
activityPlugin,       // onPipelineStart/Complete
storytellingPlugin,   // NEW — inject cast sheet + formatting instructions
contextPlugin,        // history + context files (must come after storytelling so cast is part of the prompt context sees)
...remaining plugins
```

Storytelling runs AFTER identity so the agent soul is established before cast injection. It runs BEFORE context so the cast sheet is part of the base prompt that context wraps with history. Context does not parse the prompt to avoid duplication — it unconditionally prepends history, project instructions, and files. This ordering is correct because: (1) identity establishes character foundation, (2) storytelling adds cast/world state, (3) context adds conversation history around the enriched prompt.

### The User as a Character

The user (`{{user}}`) participates in the story but is NOT a `StoryCharacter` record. The user is the user — they don't need appearance/personality/mannerisms tracked because they control their own actions.

However, the user's **in-story identity** might need a name and basic description. Options:
1. Store in `Story.metadata` as `{ userName: "Quinn", userAppearance: "..." }` — simple
2. Create a `StoryCharacter` with a special flag `isUser: true` — consistent but adds complexity
3. Let the agent handle it via OOC/instructions — least structured

**Recommendation:** Option 1 for now. The user can set their in-story name and brief description on the Story. The cast injection includes it as a simple line: `{{user}} (Quinn): [user-provided description or "no description set"]`.

### StoryMoment.locationId — FK to StoryLocation (resolved at extraction time)

`StoryMoment.locationId` is an optional FK to `StoryLocation` with `onDelete: SetNull`. Haiku receives the existing location list with IDs during extraction and returns a `locationId` for known locations or indicates a new location needs to be created. The extraction handler creates any new `StoryLocation` records first, then creates the `StoryMoment` with the resolved `locationId`. This eliminates fuzzy-matching problems.

### LocationRelationship Directionality

`LocationRelationship` has `fromId` and `toId`, but spatial relationships are usually bidirectional ("school is 2 blocks from house" = "house is 2 blocks from school"). The `@@unique([fromId, toId])` constraint means we store one row per pair. Queries should check both directions:
```sql
WHERE (fromId = X AND toId = Y) OR (fromId = Y AND toId = X)
```

---

## Technical Fit

| Concern | How it fits |
|---------|------------|
| Plugin, not orchestrator | All logic in `@harness/plugin-storytelling` |
| Existing hooks sufficient | `onBeforeInvoke` (inject cast + instructions), `onAfterInvoke` (extract characters) |
| Fire-and-forget pattern | Character extraction is async, same as episodic memory |
| PluginContext sufficient | `ctx.db` for storage, `ctx.invoker` for Haiku calls |
| Content blocks | Character sidebar uses existing block registry pattern |
| Cost | One Haiku call per response in storytelling threads (~$0.001) |

## Risks

| Risk | Severity | Mitigation | Status |
|------|----------|------------|--------|
| Claude doesn't follow formatting conventions consistently | MEDIUM | Good instructions + examples; graceful degradation | Open |
| Haiku character extraction inaccurate | MEDIUM | `//` corrections; extraction improves with cast context | Open |
| Cast grows unwieldy (50+ NPCs) | MEDIUM | Status field; only inject active characters via tiers | Open |
| Prompt bloat from large cast | HIGH | Tiered injection (2,500-4,500 tokens budget) | Mitigated |
| Character name ambiguity ("the tall one") | MEDIUM | Aliases field with GIN index; Haiku maps descriptions to known chars | Mitigated |
| Character knowledge drift over long threads | MEDIUM | Moment-based tracking is append-only; corrections via `//` | Open |
| Story time tracking inconsistency | MEDIUM | Haiku extracts time from narrative; `//` commands for correction | Open |
| Location string divergence | ~~HIGH~~ | ~~Fuzzy matching~~ → Resolved: locationId FK, Haiku resolves at extraction time | Fixed |
| currentScene race condition | ~~CRITICAL~~ | ~~Fire-and-forget~~ → Resolved: extraction is blocking, not fire-and-forget | Fixed |
| onAfterInvoke data access | ~~CRITICAL~~ | ~~Missing messages~~ → Resolved: DB query for user messages + result.output | Fixed |
| storyId/projectId mutual exclusivity | HIGH | Prisma $extends middleware rejects writes with both set | Mitigated |
| Cascade deletes | MEDIUM | Thread.storyId: SetNull, CharacterInMoment.characterId: SetNull with denormalized name | Mitigated |
| OOC interception ambiguity | MEDIUM | onMessage for command detection, onBeforeInvoke for wrapping | Mitigated |
| Extraction dedup | LOW | 60-second guard keyed on storyId | Mitigated |
| Haiku extraction prompt size | MEDIUM | Send names + IDs of existing state, not full details | Open |

## Phase Ordering

1. **Phase 1** — formatting + OOC + plugin skeleton. Delivers immediate visual value. No schema changes.
2. **Phase 2** — character detection + knowledge tracking. The core innovation. Requires schema migration.
3. **Phase 3** — character sidebar UI. Read view of Phase 2 data.
4. **Phase 4** — advanced features (split rendering, export, display modes).

---

## Test Plan

Tests follow project conventions: tests in `__tests__/` subdirectories, one test file per helper, Vitest.

### Phase 1 Tests

**`parse-narrative-blocks.ts` — parser unit tests** (`_helpers/__tests__/parse-narrative-blocks.test.ts`)
- Parses `**NAME**: "dialogue"` → dialogue block with speaker
- Parses `**NAME** *(emotion)*: "dialogue"` → dialogue block with speaker + emotion
- Parses `*italic paragraph*` → action/description block
- Parses `> blockquote` → internal thought block
- Parses `---` → scene break block
- Parses undecorated paragraph → narration block
- Handles mixed content: dialogue followed by action followed by narration
- Handles multiple speakers in one response
- Handles edge cases: empty lines, nested markdown, code blocks (should pass through unchanged)
- Handles malformed patterns gracefully (no crash, falls back to narration)
- Handles dialogue with no closing quote
- Handles speaker name with special characters

**`character-color-map.ts` — color assignment** (`_helpers/__tests__/character-color-map.test.ts`)
- Same name always returns same color (deterministic)
- Different names return different colors (collision-resistant across small sets)
- Case insensitive (SAM, Sam, sam → same color)
- Returns valid hex colors
- Manual override: if a color is provided, use it instead of hash
- Palette wraps correctly (9th character gets a color from the 8-color palette without error)

**`narrative-content.tsx` — component tests** (`_components/__tests__/narrative-content.test.tsx`)
- Renders dialogue blocks with speaker badge and colored border
- Renders action blocks with italic/muted styling
- Renders thought blocks with blockquote styling
- Renders scene breaks with decorative divider
- Renders narration as standard prose
- Renders mixed content in correct order
- Falls back to standard markdown when no narrative patterns detected
- Handles `//` prefixed user messages with director's note styling

**Storytelling plugin — `onBeforeInvoke`** (`packages/plugins/storytelling/src/__tests__/index.test.ts`)
- No-op when thread has no storyId and no storytelling metadata flag
- Injects formatting instructions when storytelling mode is active
- Wraps `//` prefixed user messages in OOC tags
- Passes unrecognized `//` messages through with OOC wrapper
- Handles `//` commands that match known patterns (rename, knowledge update, etc.)
- Does not modify prompt for non-storytelling threads

### Phase 2 Tests

**Schema / middleware tests** (`packages/database/src/__tests__/story-middleware.test.ts`)
- $extends middleware rejects thread.create with both storyId and projectId set
- $extends middleware rejects thread.update that would set both
- $extends middleware allows storyId alone
- $extends middleware allows projectId alone
- $extends middleware allows neither (standalone thread)

**`extract-story-state.ts` — extraction helper** (`_helpers/__tests__/extract-story-state.test.ts`)
- Extracts new character from Haiku response JSON → creates StoryCharacter
- Extracts character update → updates existing StoryCharacter fields
- Extracts alias mapping → adds to existing character's aliases array
- Extracts new moment with per-character perspectives → creates StoryMoment + CharacterInMoment rows
- Extracts moment with locationId for known location → sets FK correctly
- Extracts moment with unknown location → creates StoryLocation first, then sets FK
- Extracts location with parentId (containment) → sets parent relation
- Extracts spatial relationship → creates LocationRelationship
- Updates Story.currentScene with validated JSON (Zod)
- Falls back to null currentScene on invalid extraction output
- Dedup guard: skips extraction if last extraction was <60 seconds ago
- Handles empty extraction (no changes detected) gracefully
- Handles Haiku returning malformed JSON → logs error, no DB writes

**`build-cast-injection.ts` — tiered injection builder** (`_helpers/__tests__/build-cast-injection.test.ts`)
- Tier 1: characters in currentScene get full detail (appearance, personality, mannerisms, motives, backstory, relationships, moments, knowledge)
- Tier 2: recently active characters not in scene get one-liner summary
- Tier 3: all other active characters get name-only list
- Respects character status: departed/deceased characters excluded
- Limits Tier 1 moments to top 5 by importance
- Includes "Does NOT know" for Tier 1 characters (derived from moment absence)
- Includes location context for current scene location + nearby locations
- Includes story time
- Total output stays within token budget (~4,500 tokens max)
- Handles empty cast (new story, no characters yet)
- Handles story with no currentScene (injects all active as Tier 2)

**`onAfterInvoke` hook** (`packages/plugins/storytelling/src/__tests__/index.test.ts`)
- Calls extractStoryState with correct data (DB query for user messages + result.output)
- Skips extraction for non-story threads (storyId is null)
- Respects 60-second dedup guard
- Logs error on extraction failure without crashing pipeline
- Awaits extraction (blocking, not fire-and-forget)

**`onBeforeInvoke` hook — with cast injection** (extend Phase 1 tests)
- Injects cast sheet when story has characters
- Applies tiered injection based on currentScene
- Populates storyCache for MCP tool handlers
- OOC command detection via onMessage sets flag, onBeforeInvoke reads it

**`onMessage` hook — OOC command detection** (`packages/plugins/storytelling/src/__tests__/index.test.ts`)
- Detects `// rename "X" to Y` → updates StoryCharacter.name, adds alias
- Detects `// X doesn't know about Y` → handles knowledge boundary update
- Detects `// remove X from the story` → sets status to departed
- Detects `// it's now the next morning` → updates Story.storyTime
- Does not fire for non-`//` messages
- Does not fire for non-story threads
- Sets handledOocCommand flag for onBeforeInvoke

**MCP tool tests** (`packages/plugins/storytelling/src/__tests__/tools.test.ts`)
- `update_character`: updates specified fields only, returns confirmation
- `update_character`: returns error for non-story thread
- `update_character`: returns error for unknown character name
- `record_moment`: creates StoryMoment + CharacterInMoment rows
- `record_moment`: creates new StoryLocation if locationId not provided
- `advance_time`: updates Story.storyTime
- `add_location`: creates StoryLocation with parent and spatial relationships
- `character_knowledge`: returns aggregated knowledgeGained + absent moments
- `cast_summary`: returns all active characters with current state
- `get_character`: returns full character detail with moments and perspectives
- All tools: resolve storyId from storyCache, return error if not in story thread

**Recap generation** (`apps/web/src/app/(chat)/chat/_actions/__tests__/create-story-thread.test.ts`)
- Loads characters, moments, recent messages, premise
- Calls Haiku with correct prompt
- Creates thread with storyId
- Creates kind:'recap' message as first message
- Handles empty story (no characters yet) → still creates thread with basic recap
- Handles Haiku failure → creates thread without recap message (graceful degradation)

### Phase 3 Tests

**Server actions** (`apps/web/src/app/(chat)/chat/_actions/__tests__/`)
- `list-story-characters.test.ts`: returns characters for a story, filters by status, includes moment count
- `update-story-character.test.ts`: updates specified fields, validates color format, returns updated character
- `create-story.test.ts`: creates Story with name + premise + agentId
- `list-stories.test.ts`: returns all stories with thread count + character count

**Component tests** (if using React Testing Library)
- Character sidebar renders character list with color dots
- Character expand shows all fields (appearance, personality, mannerisms, etc.)
- Moment timeline renders chronologically with kind icons
- Inline edit saves changes via server action

### Integration Tests

**Full pipeline test** (`tests/integration/storytelling-plugin.test.ts`)
- Message in story thread → onBeforeInvoke injects cast → Claude responds → onAfterInvoke extracts state → currentScene updated
- New character introduced in response → StoryCharacter created with correct storyId
- Significant moment in response → StoryMoment + CharacterInMoment created
- New location mentioned → StoryLocation created
- OOC `//` command → character updated, response acknowledges
- New thread in story → recap generated with correct character state
- Characters from Thread 1 available in Thread 2 of same story
- Tiered injection: in-scene characters get full detail, others get summaries
