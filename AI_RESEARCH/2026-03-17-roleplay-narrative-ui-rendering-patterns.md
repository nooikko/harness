# Research: Roleplay and Narrative UI Rendering Patterns
Date: 2026-03-17

## Summary

Research into how modern AI roleplay and interactive fiction platforms visually render narrative text — covering SillyTavern, NovelAI, Character.AI, AI Dungeon, KoboldAI/Text Generation WebUI, Ren'Py visual novel conventions, chat fiction apps, and Tupperbox (Discord). The goal is to identify UI components and patterns applicable to a web chat interface that needs to render roleplay/narrative responses with more structure than plain markdown.

## Prior Research
- `2026-02-26-markdown-rendering-chat-ui.md` — general markdown rendering in chat UI
- `2026-03-12-premium-ui-patterns-linear-vercel-raycast.md` — premium UI patterns

---

## Current Findings

### 1. SillyTavern

**Source:** https://docs.sillytavern.app/usage/core-concepts/uicustomization/ and https://deepwiki.com/SillyTavern/SillyTavern/4-user-interface

**Architecture:** Single-page app, vanilla JS + jQuery + CSS custom properties. Chat is a flex column container (`#chat`). Each message is a `.mes` DOM block cloned from a template.

**Message HTML Structure:**
```
.mes [data-mesid="5" is_user="true"]
├── .mesAvatarWrapper
│   └── .avatar > img
├── .mes_block
│   ├── .mes_header_block
│   │   ├── .ch_name           ← character/persona name
│   │   ├── .mes_timer         ← generation time
│   │   └── .tokenCounterDisplay
│   ├── .mes_text              ← markdown-rendered content
│   │   ├── .mes_bias
│   │   └── .mes_reasoning_details
│   └── .mes_buttons (edit, copy, delete, regenerate, etc.)
```

**Three Display Modes:**
- **Flat** ("clean chat log"): messages flow continuously, avatars on side, standard left-to-right layout
- **Bubbles** ("instant messenger"): rounded bubble containers with subtle 3D effect, alternating alignment, user right / AI left
- **Document**: text-focused, hides avatars + timestamps + action buttons for past messages, centered prose layout

**Text Type Color Customization (separate color pickers for each):**
- Main Text
- Italics Text (distinct color from main — the primary tool for styling action/narration)
- Underlined Text
- Quote Text (distinct color — used for dialogue)
- Text Shadow
- User Message (bubble background)
- AI Message (bubble background)

**CSS Variables:**
- `--SmartThemeBodyColor` — primary text
- `--SmartThemeEmColor` — emphasis/italic text
- `--SmartThemeQuoteColor` — quoted dialogue text
- `--SmartThemeChatTintColor` — chat area background
- `--SmartThemeBotMesBlurTintColor` — AI message blur/tint
- `--SmartThemeUserMesBlurTintColor` — user message blur/tint

**Roleplay Convention (not enforced by UI, but community standard):**
- `*asterisks*` = narration / actions → rendered as `<em>` → styled with Italics Text color
- `"quotation marks"` = spoken dialogue → rendered with Quote Text color (if "render quotes" enabled)
- No explicit visual container around action text vs dialogue — the color difference is the only signal

**Per-Character Style Extension (Character Style Customizer):**
- Injects CSS variables scoped per character: `--csc-char-primary`, `--csc-char-bg-primary`
- Can style: character name color, quote color, italic color, bold color, link color, blockquote border color
- Two modes: Message CSS (scoped to that character's messages only) vs Global CSS (affects full page)
- This is a third-party extension, not core

**Markdown Processing:** Showdown.js converts markdown. Supports italics, bold, quotes, code blocks. "Auto-fix Markdown" toggle corrects unclosed asterisks/quotes.

**Confidence: HIGH** (official docs + DeepWiki technical analysis)

---

### 2. NovelAI

**Source:** https://docs.novelai.net/en/text/editor/

**Architecture:** ProseMirror-based rich text editor (Editor V2). Distinct from chat — it's a collaborative writing canvas.

**Text Origin Color Coding (the key differentiator):**
- Initial/prompt text: **cream** color
- AI-generated text: **white**
- User edits to AI text: **pink**
- User-authored text: **blue**

This is purely about authorship provenance, not content type (dialogue vs narration).

**Dialogue Highlighting (optional, Editor V2 only):**
- Detects text inside quotation marks and applies `.dialogue` CSS class
- Default CSS: `.ProseMirror .dialogue { color: rgb(254,249,205); }` (light cream/yellow)
- An "Inverted" mode highlights text OUTSIDE quotation marks instead (i.e., highlights narration)
- Users can override via Custom CSS in their theme

**No narration/action distinction beyond dialogue:** NovelAI does not have a separate visual treatment for `*action*` text vs narrative prose vs internal thoughts — the dialogue highlighting is the only semantic distinction.

**Customization:** Full theme system in Theme tab; all colors editable. Custom CSS allowed.

**Confidence: HIGH** (official docs)

---

### 3. Character.AI

**Source:** https://networkbuildz.com/character-ai-text-formatting-asterisk-parentheses-brackets/ and search results

**Architecture:** Standard chat bubble UI. No special semantic rendering beyond markdown.

**Formatting conventions (syntax only, minimal visual differentiation):**
- `*text*` → standard italic (used for actions/narration)
- `**text**` → bold
- `***text***` → bold italic
- `~text~` → strikethrough
- `(text)` or `[text]` → OOC (out of character) — NO visual change, purely semantic signal to the AI
- `#text` → headings (H1-H5)

**Key finding:** Character.AI does NOT apply distinct background colors, border colors, or container styling to differentiate dialogue from action text. The only visual difference is italic vs non-italic font weight. OOC parentheses don't even get visual styling — they're invisible to the rendering layer.

**Chat bubble appearance:** Standard rounded bubble per message. Character avatar shown. Character name displayed above bubble.

**Confidence: MEDIUM** (community documentation, not official UI spec)

---

### 4. AI Dungeon

**Source:** https://help.aidungeon.com/the-do-mode, AI Dungeon Wiki search results

**Architecture:** Story text display area + typed input with selectable input mode.

**Input Type Modes (the visual differentiator):**
- **Do**: Prefixes input with `> You` — converts first-person to second-person. Displayed as player action.
- **Say**: Prefixes with `> You say` — wraps input in quotation marks.
- **Story**: Feeds directly into narrative without prefix — allows author-mode writing.
- **Continue**: AI continues from last output.

**Visual distinction:** Player inputs appear in one color, AI responses in another. The `>` prefix visually marks player actions vs AI narration. The story display area is a scrolling prose block, not individual chat bubbles.

**Key design pattern:** The "prefix" pattern — prepending `> You` or `> You say` creates a visual callout that makes player agency visible in the flow of narrative prose. This is more like a terminal/typewriter aesthetic than a chat bubble aesthetic.

**Confidence: MEDIUM** (help docs + wiki, no direct UI screenshot analysis)

---

### 5. KoboldAI / Text Generation WebUI (oobabooga)

**Source:** GitHub wiki, runpod.io blog

**KoboldAI Lite architecture:** Browser-based UI with multiple modes:
- **Story mode**: flowing prose, single text area
- **Adventure mode**: action-based like AI Dungeon (with `>` prefix for actions)
- **Chat mode**: messenger-style bubbles with character name labels
- **Instruct mode**: assistant/user turn pairs

**Visual themes available:** "Aesthetic Roleplay", "Classic Writer", "Corporate Assistant", "Messenger" — each applies different CSS to the same underlying structure.

**Text generation WebUI (oobabooga):**
- CSS files at `css/chat_style-name.css` — fully swappable per deployment
- `html_instruct_style.css` for instruct mode
- No semantic distinction between dialogue/narration beyond markdown rendering
- Character name appears as a label before their message block (not in a bubble header)
- Supports dark/light themes, syntax highlighting for code

**Shared convention with SillyTavern:** `*asterisks*` for actions (rendered italic), quotes for speech. Color differentiation via theme CSS, not semantic HTML tags.

**Confidence: MEDIUM** (GitHub docs, not official visual screenshots)

---

### 6. Ren'Py Visual Novel Conventions

**Source:** https://www.renpy.org/doc/html/dialogue.html, Fuwanovel UI anatomy article

**Two display paradigms:**

**ADV Mode (Adventure — the standard):**
- Textbox occupies bottom ~1/8 of screen as a translucent panel
- Character name shown in a **namebox** — a separate styled frame above the dialogue text, left-aligned
- Namebox uses `gui/namebox.png` as background, with `who_color` setting for name text color
- Dialogue text fills the textbox below the namebox
- Character sprite shown as a tall image in the middle/side of screen
- Click-to-continue indicator (usually a small blinking arrow/chevron)
- Design principle: textbox should "disappear" when reading — maximum 1/3 filled, generous whitespace

**NVL Mode (Novel — for extended narration):**
- Textbox covers most/all of screen
- Multiple dialogue blocks visible simultaneously (stacked)
- No persistent UI buttons — accessed via pause menu
- Speaker attribution can be omitted (narration) or shown inline

**Web chat translation of ADV pattern:**
- Namebox → character name header above or overlapping the message bubble
- Translucent textbox → semi-transparent message card
- Sprite → character avatar (could be animated, emotion-reactive)
- Click-to-continue → streaming reveal or "typing" indicator

**Visual novel typography conventions:**
- Name in accent color (brand/character color)
- Dialogue in body text (white/light on dark)
- Narration (no name shown) in slightly dimmer text or italic
- Internal thoughts: often in a different color (gray/muted) or wrapped in italics

**Confidence: HIGH** (official Ren'Py docs + community design guides)

---

### 7. Chat Fiction Apps (Hooked, Yarn, Episode)

**Source:** Wikipedia (Hooked), UI Sources (Yarn), makeuseof.com

**Core concept:** Stories told as mock SMS/text message threads. Each "chapter" is a sequence of tappable bubbles.

**Visual presentation:**
- Standard iMessage-style layout: alternating left/right bubbles per character
- Each character has a fixed bubble COLOR (not just alignment) — e.g., Character A always blue, Character B always green
- Character name shown above their first bubble in a sequence
- No distinction between dialogue and narration within bubbles — everything is "messages"
- Some apps add narrator bubbles in a distinct style (center-aligned, no bubble background, italic text)
- Tap-to-advance: user taps screen to reveal next bubble one at a time (creates drama/pacing)
- Media support: images, audio clips embedded as bubbles inline with text

**Episode (interactive fiction, more visual novel-like):**
- Has a hybrid: text bubbles at bottom + animated character sprites + scene backgrounds
- Character name shown as a colored label on their speech bubble
- OOC narrator text shown center-screen without a bubble

**Key design pattern for web chat:** Character-specific bubble colors as persistent identity markers. Each character in a conversation gets a color assignment that makes multi-character scenes scannable.

**Confidence: MEDIUM** (app store descriptions, reviews, UI Sources screenshots)

---

### 8. Tupperbox (Discord Roleplay)

**Source:** https://discord-media.com/en/news/tupperbox-bot-guide and tupperbox.app

**Mechanism:** Discord webhook impersonation. When a user types a message with their character's trigger brackets (e.g., `[CharacterName]` or `CharacterName::message`), Tupperbox:
1. Deletes the original message
2. Creates a temporary webhook with the character's registered name and avatar
3. Posts the message through that webhook, appearing as if a separate Discord user sent it

**Visual result in Discord:**
- Message shows custom **avatar** (character portrait/art) on the left
- Message shows custom **display name** (character name, not user's Discord name)
- Messages have the standard Discord bubble appearance with a "Bot" tag
- No special color coding beyond what Discord's own roleplay communities layer on (e.g., colored role names)
- Multiple characters in one server = multiple distinct "users" visually

**Key insight:** This is the gold standard for "character as a separate entity" UI. Each character occupies their own identity slot in the chat stream, indistinguishable from a real user account. The webhook mechanism is the technical foundation; the UX result is clean character separation.

**Web dashboard (tupperbox.app):** Visual interface for uploading avatars, setting names, organizing character groups.

**Confidence: HIGH** (official site + community guides)

---

## Synthesis: Common UI Patterns Across Platforms

### Pattern 1: The Italic Convention
**Used by:** SillyTavern, Character.AI, KoboldAI, Talemate
- `*asterisks*` = action/narration → italic rendering
- Quotation marks = spoken dialogue → optionally colored differently
- Distinction is entirely typographic, no structural HTML difference
- SillyTavern makes this explicit with separate color pickers for "Italics Text" and "Quote Text"

**Web implementation:** Apply distinct colors to `<em>` elements vs `<q>` or blockquote elements within `.message-text`. No extra markup needed if the model uses the convention.

### Pattern 2: The Color-Per-Character System
**Used by:** Chat fiction apps (Yarn/Hooked), SillyTavern (via extension), Tupperbox (implicit)
- Each character gets an assigned color for their name/bubble border/background
- Color persists across all their messages for immediate recognition
- Usually a small palette (5-8 colors) cycling through cast members

**Web implementation:** Assign a deterministic color from a palette based on character name hash or index. Apply as: bubble border-left color, name text color, or subtle background tint.

### Pattern 3: The Namebox/Speaker Label
**Used by:** Ren'Py (ADV mode), visual novels broadly, SillyTavern (`.ch_name`), Character.AI, Tupperbox
- Character name displayed distinctly above or overlapping the text block
- Accent color matches character's assigned color
- Narration has no name or uses "Narrator" in muted styling

**Web implementation:** Absolute-positioned name badge overlapping the top of a message card (visual novel style), or a simple `<header>` above the bubble text. The "namebox" pattern (name in a differently-styled frame than dialogue) is the most visually distinctive.

### Pattern 4: The Content Type Badge
**Not yet mainstream** — no major platform does this explicitly yet, but the conventions suggest it:
- Dialogue → no badge (default)
- Action/Narration → small `*` or italic indicator
- Internal thought → parenthetical or gray text
- OOC → bracket callout

**Opportunity:** A small content-type badge or left-border color could make this machine-readable and visually scannable. This is a greenfield design space.

### Pattern 5: The Document Mode
**Used by:** SillyTavern (Document display mode), NVL visual novels, NovelAI editor
- Strip away chat chrome (no avatars, no timestamps, no action buttons)
- Present as flowing prose
- Speaker attribution via inline label (bold name followed by colon) rather than UI chrome
- Typography-driven rather than component-driven

**Web implementation:** A prose stylesheet that applies `font-family: Georgia/serif`, wider line-height, and centers the column. Speaker names rendered as `**Name:** dialogue text` inline.

### Pattern 6: The Webhook/Persona Split
**Used by:** Tupperbox, group chat roleplay
- Each character is a full identity (name + avatar) not just a label
- In a multi-character scene, the chat scrolls through distinct "senders"
- No mixing of characters within a single bubble

**Web implementation:** For AI responses that involve multiple characters, split the response into per-character message blocks, each with their own avatar and name. Requires parsing the response to detect character attribution.

---

## Key Takeaways for Web Chat Implementation

1. **The italic convention is universal and low-effort** — just style `<em>` with a distinct color (muted purple, gray-blue, etc.) different from dialogue text. This alone makes responses feel more structured.

2. **Quote text color is the second most impactful change** — coloring `"quoted dialogue"` differently (warmer yellow/cream like NovelAI's `rgb(254,249,205)`) creates immediate visual hierarchy without changing HTML structure.

3. **Character name as a colored header** (not just gray text) is the single biggest UI differentiator between "chat app" and "roleplay platform" feel.

4. **SillyTavern's three display modes are worth implementing:** Flat (chat log), Bubbles (messenger), Document (prose). Let users switch. Document mode is particularly useful for long narrative sessions.

5. **Per-character bubble color** (even just a left border color) dramatically improves multi-character scene readability. Use a small deterministic palette.

6. **Tupperbox's insight:** The ideal multi-character UI treats each character as a separate "sender" with their own avatar slot. If your AI produces responses that switch between characters, consider parsing and splitting them into separate message blocks.

7. **The content-type badge is unexplored territory** — no major platform has a structured "this block is dialogue / this block is narration / this block is action" UI component. This could be a differentiator.

---

## Gaps Identified

- No direct screenshot analysis was possible for Character.AI's current 2026 UI (paywalled/auth-required)
- AI Dungeon's exact color scheme for player vs AI text could not be confirmed from docs (403 on wiki)
- Talemate's specific Vue component structure for message rendering was not documented publicly
- DreamGen's in-app story editor UI specifics were not found in public docs
- KoboldAI Lite's specific CSS for "Aesthetic Roleplay" theme was not retrieved

---

## Sources

- [SillyTavern UI Customization](https://docs.sillytavern.app/usage/core-concepts/uicustomization/)
- [SillyTavern DeepWiki — User Interface](https://deepwiki.com/SillyTavern/SillyTavern/4-user-interface)
- [SillyTavern DeepWiki — Main UI Components](https://deepwiki.com/SillyTavern/SillyTavern/4.1-main-ui-components-and-layout)
- [Character Style Customizer Extension](https://github.com/Sovex666/SillyTavern-CharacterStyleCustomizer)
- [NovelAI Editor Documentation](https://docs.novelai.net/en/text/editor/)
- [Character.AI Text Formatting Guide](https://networkbuildz.com/character-ai-text-formatting-asterisk-parentheses-brackets/)
- [AI Dungeon Do Mode Help](https://help.aidungeon.com/the-do-mode)
- [oobabooga text-generation-webui Chat Tab Wiki](https://github.com/oobabooga/text-generation-webui/wiki/01-%E2%80%90-Chat-Tab)
- [Ren'Py Dialogue Documentation](https://www.renpy.org/doc/html/dialogue.html)
- [Fuwanovel Visual Novel UI Anatomy](https://forums.fuwanovel.moe/blogs/entry/4226-ui-design-%E2%80%93-an-anatomy-of-visual-novels/)
- [Hooked app — Wikipedia](https://en.wikipedia.org/wiki/Hooked_(app))
- [Yarn app — UI Sources](https://uisources.com/app/yarn)
- [Tupperbox Guide](https://discord-media.com/en/news/tupperbox-bot-guide-the-ultimate-identity-tool-for-roleplay)
- [Tupperbox Official Site](https://tupperbox.app/)
- [Talemate Scene Interaction](https://vegu-ai.github.io/talemate/user-guide/interacting/)
- [KoboldAI on RunPod](https://www.runpod.io/blog/koboldai-roleplay-front-end)
