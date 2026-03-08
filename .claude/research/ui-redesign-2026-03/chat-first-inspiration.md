# Chat-First UI Inspiration — Research Index

**Research Date:** 2026-03-05
**Directory:** `.claude/research/ui-redesign-2026-03/screenshots/chat-first/`

## Core Concept

The chat/conversation is ALWAYS the primary surface. Widgets (music player, timers, device controls, status indicators) appear as floating elements, docked panels, sliding sidebars, or inline cards within or beside the chat — never requiring navigation away from the conversation.

---

## Category 1: Chat + Artifact/Canvas Side Panel

The split-screen model where chat stays on the left and a live preview/editor opens on the right. Neither surface requires abandoning the other.

### claude-projects-artifacts-panel.png
**Source:** https://www.anthropic.com/news/projects
**Pattern:** Side panel that opens beside the conversation to display artifacts (code, docs, apps). Claude keeps chat on left, artifact rendered on right. Clicking a card in chat opens the panel — never navigates away.
**Key design:** Clickable card in chat expands to a panel view. Chat thread remains visible and interactive while the artifact is open.

### claude-projects-hero.png
**Source:** https://www.anthropic.com/news/projects
**Pattern:** Hero shot of Claude Projects interface showing the full three-pane layout: project sidebar + conversation + context.

### claude-projects-document-upload.png
**Source:** https://www.anthropic.com/news/projects
**Pattern:** Document/file management in Claude Projects — how knowledge sources sit alongside the conversation.

### claude-projects-custom-instructions.png
**Source:** https://www.anthropic.com/news/projects
**Pattern:** Settings/configuration panel accessible from within the conversation context.

### chatgpt-canvas-split-view.webp
**Source:** https://ai-basics.com/how-to-use-chatgpt-canvas/
**Pattern:** ChatGPT Canvas — the canonical split-view pattern. Chat thread on the left, writable document or code editor on the right. Both surfaces are live and interactive simultaneously.
**Notes:** Canvas opened via "use canvas" prompt or auto-detected by model. Inline comment/suggestion system inside the canvas panel. Source: https://help.openai.com/en/articles/9930697-what-is-the-canvas-feature-in-chatgpt-and-how-do-i-use-it

---

## Category 2: Floating / Persistent Overlay Controls

Controls that stay visible on top of other content, expanding on demand — like Apple's Dynamic Island.

### discord-overlay-final-in-action.png
**Source:** https://discord.com/blog/redesigning-the-discord-overlay
**Pattern:** Discord's in-game overlay — voice/chat controls floating over a game at a configurable position. Users see who's talking, text notifications, and can access chat without alt-tabbing. This is the canonical "floating over content" pattern.
**Key design:** Transparent/semi-transparent overlay that doesn't block the primary surface.

### discord-overlay-widget-concept.png
**Source:** https://discord.com/blog/redesigning-the-discord-overlay
**Pattern:** Widget concept exploration from Discord's overlay redesign process. Windowed features that can be moved around, resized, shown, or hidden — each widget independently positionable.
**Key insight:** The redesign moved from a monolithic overlay to individual draggable widgets. Same insight applies to chat-first: each contextual panel (music, timer, status) is an independent widget, not a fixed layout.

### discord-overlay-text-voice-widgets.png
**Source:** https://discord.com/blog/redesigning-the-discord-overlay
**Pattern:** Shows both text chat widget and voice channel widget simultaneously floating. Dual-widget layout.

### discord-overlay-voice-widget.png
**Source:** https://discord.com/blog/redesigning-the-discord-overlay
**Pattern:** Early voice widget design — compact persistent indicator showing who's speaking. The minimal "always visible" state before expansion.

### discord-overlay-widget-header-bar.png
**Source:** https://discord.com/blog/redesigning-the-discord-overlay
**Pattern:** Widget header bar design — the grab handle and controls for repositionable floating panels.

### discord-overlay-old-vs-new.png
**Source:** https://discord.com/blog/redesigning-the-discord-overlay
**Pattern:** Before/after comparison of Discord overlay redesign. Shows evolution from monolithic overlay to modular widget system.

---

## Category 3: Persistent Docked Bars

Always-visible status bars that anchor to a screen edge and persist across context switches.

### slack-ai-split-view-agents.png
**Source:** https://website-cms.eesel.ai/wp-content/uploads/2025/11/13-Slack-AI-Split-View-Agents.png (via https://www.eesel.ai/blog/slack-ai-split-view-agents)
**Pattern:** Slack's AI agent split view — the agent chat panel stays fixed on the right side of the screen even as you switch between different Slack conversations. The AI companion panel persists across context switches.
**Key insight:** The persistent right rail for AI is independent of the main navigation. This is how music/timer widgets should behave — stay visible regardless of which conversation is active.

### google-chat-split-pane-ui.jpg
**Source:** https://9to5google.com/2024/11/14/google-chat-split-pane/
**Pattern:** Google Chat split pane — conversation list on left, active conversation on right. Clicking any conversation opens it in the right pane without navigating away from the list. Multi-column layout supporting up to 4 columns.
**Context:** Rolled out November-December 2024. Source: https://workspaceupdates.googleblog.com/2024/11/reply-in-google-chat-home.html

---

## Category 4: Contextual Side Panels (Content + Detail)

The "master-detail" pattern where selecting something in a list opens details in an adjacent panel.

### linear-combined-board-issue-view.png
**Source:** https://webassets.linear.app (via https://linear.app/changelog/2022-05-26-combined-board-and-issue-view)
**Pattern:** Linear's combined board + issue view. The issue detail panel opens beside the board/list — you never lose your place in the list while reading issue details. Triage split view specifically: issue list on left, focused issue on right.
**Key design:** Two interactive surfaces. Actions in the detail panel reflect in the list in real-time.

### linear-new-ui-overview.png
**Source:** https://webassets.linear.app (via https://linear.app/now/how-we-redesigned-the-linear-ui)
**Pattern:** Linear's redesigned UI overview — shows the full layout with inverted-L navigation, main content, and right sidebar for meta properties.

### linear-views-tested-new-ui.png
**Source:** https://webassets.linear.app
**Pattern:** Different view modes in Linear's new UI — list, board, timeline showing how the same content surface adapts.

### linear-sidebar-alignment-panels.png
**Source:** https://webassets.linear.app
**Pattern:** Sidebar alignment design study — how the left navigation and right detail panels relate to the main content area.

---

## Category 5: Inline Interactive Cards in Chat

Rich content rendered directly inline in the conversation flow — not a separate panel, but a card embedded in the message stream.

### notion-ai-contextual-popup.png
**Source:** https://cdn.prod.website-files.com (via https://www.eleken.co/blog-posts/chatbot-ui-examples)
**Pattern:** Notion AI contextual popup — appears as a sidebar or pop-up often located inside the user's document. Inline AI suggestions that appear within the editing context without navigating away.

### notion-ai-sidebar-popup.avif
**Source:** https://cdn.prod.website-files.com (via https://arounda.agency/blog/chatbot-ui-examples)
**Pattern:** Notion AI as a sidebar/popup pattern — the AI appears where the content is, not on a separate page.

### otter-ai-transcript-side-panel.avif
**Source:** https://cdn.prod.website-files.com (via https://arounda.agency/blog/chatbot-ui-examples)
**Pattern:** Otter.ai live transcript with AI-generated summaries and action items in a side panel. The transcript (conversation) is the primary surface, the AI summary panel is contextual.

---

## Category 6: Code Editor + Chat (AI Pair Programming)

The developer tool pattern where chat sits beside live code — the chat informs the code but the code surface remains primary.

### vscode-copilot-chat-sidebar.png
**Source:** https://code.visualstudio.com/docs/copilot/chat/copilot-chat
**Pattern:** VS Code Copilot Chat in the Secondary Side Bar. Chat on one side, code editor in the main area. Can be configured as Primary or Secondary sidebar.
**Key quote:** "The Explorer view can be shown in the Primary Side Bar and the Copilot Chat view in the Secondary Side Bar"

### cursor-ai-editor-main-interface.jpg
**Source:** https://ptht05hbb1ssoooe.public.blob.vercel-storage.com (via https://cursor.com/features)
**Pattern:** Cursor AI editor — the agent-centric interface where agents, plans, and runs are first-class objects in a sidebar with conversation and diffs front and center. More than "VS Code + chat panel."

### cursor-ai-codebase-understanding.png
**Source:** https://ptht05hbb1ssoooe.public.blob.vercel-storage.com
**Pattern:** Cursor codebase understanding — how the AI indexes and displays codebase context alongside the conversation.

---

## Category 7: AI-Specific UI Patterns (Shape of AI)

Pattern cards from https://www.shapeof.ai — a research taxonomy of AI UX patterns.

### shape-of-ai-wayfinder-gallery.webp
**Pattern:** Gallery/wayfinder — how AI surfaces discovery and navigation within a conversation.

### shape-of-ai-autofill-pattern.webp
**Pattern:** Autofill input patterns — how AI suggests completions inline in the input surface.

### shape-of-ai-plan-of-action.webp
**Pattern:** Plan of action — how AI externalizes its reasoning/steps as a visible panel alongside the response.

### shape-of-ai-stream-of-thought.webp
**Pattern:** Stream of thought — how AI thinking is displayed as an expanding/collapsible section in the conversation.

### shape-of-ai-human-in-loop.webp
**Pattern:** Human in the loop — confirmation/approval UI embedded in the conversation flow.

---

## Category 8: Persistent Music/Media Player (Floating)

### abduzeedo-chat-ui-inspiration.jpg
**Source:** https://abduzeedo.com/sites/default/files/originals/new_chat2.jpg
**Pattern:** Chat UI inspiration including persistent elements in the conversation flow.

---

## Category 9: Multi-Service Chat with Contextual Panels

### intercom-inbox-conversation-panel.avif
**Source:** https://cdn.prod.website-files.com (via https://www.saasframe.io/examples/intercom-help-desk-inbox)
**Pattern:** Intercom inbox — conversation list + active conversation + customer context panel. Three-column layout where customer data (history, plan, activity) sits in the right rail alongside the active chat thread. Described as: "a customizable right-hand sidebar displaying customer data alongside the conversation."

### flair-chat-alongside-workspace.avif
**Source:** https://cdn.prod.website-files.com (via https://arounda.agency/blog/chatbot-ui-examples)
**Pattern:** Flair — chat panel positioned alongside a structured workspace with a professional color palette.

### youchat-sidebar-nav-persistent.avif
**Source:** https://cdn.prod.website-files.com (via https://arounda.agency/blog/chatbot-ui-examples)
**Pattern:** YouChat — left sidebar navigation with persistent utilities alongside the conversation area.

---

## Category 10: Search-as-Chat with Inline Sources

### perplexity-ai-query-response-sources.png
**Source:** https://cdn.cmsfly.com (via https://dorik.com/blog/how-to-use-perplexity-ai)
**Pattern:** Perplexity AI — search results rendered as inline cards within the answer. Sources are shown as numbered citations within the text, with a sources panel. The conversation IS the search results.

### perplexity-ai-interface-overview.jpg
**Source:** https://cdn.cmsfly.com
**Pattern:** Perplexity overview — the full layout including sidebar (history, collections, discover) and main answer area.

---

## Category 11: Concept / Dribbble Designs

### ai-chatbot-ui-dribbble-1.jpg
**Source:** https://layers-uploads-prod.s3.eu-west-2.amazonaws.com (via https://muz.li/inspiration/chat-ui/)
**Pattern:** AI chatbot UI concept — structured layout with contextual panels.

### ai-chatbot-ui-dribbble-2.jpg
**Source:** https://layers-uploads-prod.s3.eu-west-2.amazonaws.com (via https://muz.li/inspiration/chat-ui/)
**Pattern:** AI chatbot UI concept — second variant.

### sleek-ai-chat-mobile-dribbble.png
**Source:** https://layers-uploads-prod.s3.eu-west-2.amazonaws.com (via https://muz.li/inspiration/chat-ui/)
**Pattern:** Sleek AI chat mobile app concept — modern mobile layout.

### chatgpt-interface-overview.png
**Source:** https://cdn.prod.website-files.com (via https://www.eleken.co/blog-posts/chatbot-ui-examples)
**Pattern:** ChatGPT interface overview showing the standard chat layout for comparison.

---

## Key Design Patterns Identified

### 1. Split-Pane (Canonical)
Chat on left, contextual panel on right. Both surfaces remain interactive. Best examples: ChatGPT Canvas, Cursor AI, VS Code Copilot, Linear Triage, Claude Artifacts.

**Design principle:** Neither surface "owns" the window. The split can be resized. Closing the panel returns to full-width chat.

### 2. Persistent Right Rail
A fixed right-side panel that remains visible as you navigate the left pane. Best examples: Slack AI Agent panel, Intercom customer context, Spotify "Now Playing" sidebar.

**Design principle:** The right rail persists across navigation. It shows context for whatever is selected/active in the left pane. Can be toggled but doesn't close on navigation.

### 3. Draggable Widget Overlay
Floating panels that sit over the primary surface, repositionable by the user. Best example: Discord in-game overlay with individual widgets (voice, chat, notifications).

**Design principle:** Each widget is independent — can be shown/hidden, moved, resized. Widgets don't block primary content because they're transparent or positioned by the user.

### 4. Dynamic Island / Pill Bar
A compact persistent indicator that expands on tap/hover to show controls. Examples: Apple Dynamic Island (music controls, timer, call status), Discord voice activity indicator, Spotify mini player.

**Design principle:** Two states — minimal (shows only essential status: playing, timer counting, who's speaking) and expanded (shows full controls). Transitions are animated. Always visible at screen top/bottom.

### 5. Inline Cards in Message Stream
Rich interactive content rendered inside the conversation flow as cards. Examples: Notion AI suggestions, Perplexity source cards, Telegram inline bot keyboards.

**Design principle:** The card IS the message. No navigation required. The card can have interactive controls (play/pause, approve/reject, expand/collapse) that operate in-place.

---

## Patterns Relevant to Harness Chat-First Redesign

| Widget Type | Best Pattern Reference | Key Behavior |
|-------------|----------------------|--------------|
| Music Player (YouTube Music) | Discord voice widget + Spotify mini player | Persistent pill at bottom expands to full controls |
| Cron Timer / Active Tasks | Dynamic Island / Discord overlay | Always-visible countdown, expands to show task detail |
| Device Controls (Cast, etc.) | Inline card in chat | Shows as a card in the message that triggered it |
| Agent Status | Slack AI agent right rail | Persistent status bar showing active agents |
| Thread Context / Memory | Linear right sidebar | Opens beside conversation when clicking a memory reference |
| Search Results / Sources | Perplexity inline cards | Rendered inline within the response as expandable cards |
| Code/Artifact Output | ChatGPT Canvas / Claude Artifacts | Split pane: chat left, output right |

---

## Sources Consulted

- https://www.anthropic.com/news/projects — Claude Projects artifacts panel
- https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them — Claude Artifacts documentation
- https://help.openai.com/en/articles/9930697-what-is-the-canvas-feature-in-chatgpt-and-how-do-i-use-it — ChatGPT Canvas documentation
- https://discord.com/blog/redesigning-the-discord-overlay — Discord overlay redesign case study
- https://9to5google.com/2024/11/14/google-chat-split-pane/ — Google Chat split pane rollout
- https://www.eesel.ai/blog/slack-ai-split-view-agents — Slack AI split view agents
- https://linear.app/now/how-we-redesigned-the-linear-ui — Linear UI redesign case study
- https://linear.app/changelog/2022-05-26-combined-board-and-issue-view — Linear combined board+issue view
- https://www.saasframe.io/examples/intercom-help-desk-inbox — Intercom inbox UI
- https://spotify.design/article/small-but-mighty-weve-rolled-out-changes-to-the-now-playing-bar — Spotify Now Playing bar
- https://developer.chrome.com/blog/spotify-picture-in-picture — Spotify mini player technical implementation
- https://code.visualstudio.com/docs/copilot/chat/copilot-chat — VS Code Copilot Chat documentation
- https://cursor.com/features — Cursor AI editor features
- https://www.shapeof.ai/ — Shape of AI pattern library
- https://muz.li/inspiration/chat-ui/ — Muzli chat UI inspiration
- https://arounda.agency/blog/chatbot-ui-examples — Arounda chatbot UI examples
- https://www.eleken.co/blog-posts/chatbot-ui-examples — Eleken chatbot UI examples
- https://dorik.com/blog/how-to-use-perplexity-ai — Perplexity AI interface guide
- https://multitaskai.com/blog/chat-ui-design/ — Chat UI design trends 2025
- https://intuitionlabs.ai/articles/conversational-ai-ui-comparison-2025 — AI UI comparison 2025
- https://www.shapeof.ai/ — Shape of AI UX pattern library
- resources.arc.net — Arc browser split view documentation
- https://smoothui.dev/docs/components/dynamic-island — Dynamic Island component
- https://www.figma.com/community — Dynamic Island Figma resources
