# Visual Inspiration Index — Harness Dashboard Redesign
Date: 2026-03-05

## Overview

This index documents visual inspiration gathered for the Harness AI orchestrator dashboard redesign. 36 images were successfully downloaded to `/Users/quinn/dev/harness/.claude/research/ui-redesign-2026-03/screenshots/`. Sources span Dribbble, Behance, GitHub READMEs, design blogs, and product showcases.

Design areas covered:
- AI chat interfaces with widget/tool panels
- Smart home dashboards (widget slot pattern)
- Modular bento grid layouts
- Dark mode / glassmorphism depth
- ShadCN-based production apps

---

## Category 1: AI Chat + Widget Interfaces

### 1. Accern Rhea — Split-Screen Research Dashboard
- **File:** `ai-split-screen-accern-rhea-01.avif`
- **Source:** https://www.lazarev.agency/articles/ai-dashboard-design
- **What's notable:** Split-screen layout: analysis panel on the left, report assembly panel on the right. Demonstrates the pattern of combining a conversational/data input surface with a structured output panel side-by-side. This is the closest existing analogue to our vision of chat + contextual widget panel.
- **Relates to:** Chat interface, widget slots

### 2. VTNews.ai — Media Intelligence Dashboard
- **File:** `ai-news-dashboard-vtnews-01.avif`
- **Source:** https://www.lazarev.agency/articles/ai-dashboard-design
- **What's notable:** Real-time content monitoring with AI-generated summaries, multi-panel layout showing different data streams simultaneously. Strong information density without visual clutter.
- **Relates to:** Admin/analytics views, chat interface

### 3. Pika AI — Search + Chat Integration
- **File:** `ai-search-interface-pika-01.avif`
- **Source:** https://www.lazarev.agency/articles/ai-dashboard-design
- **What's notable:** F-pattern layout with AI chat positioned below the search bar for query refinement. Vivid blue brand gradient. Shows how AI interaction can be surfaced as a first-class element rather than a modal or overlay.
- **Relates to:** Chat interface

### 4. Promptly — AI Chatbot Dark Mode
- **File:** `ai-chatbot-dark-promptly-01.jpg`
- **Source:** https://www.behance.net/gallery/227751367/Promptly-AI-Powered-Chatbot-UI-Design-(Dark-Mode)
- **What's notable:** Dark-mode-first AI assistant UI for designers/professionals. Features smart prompt history, contextual sidebar insights alongside main chat, and clean responsive layout. The sidebar-insights pattern is directly applicable to our right-panel widget slots.
- **Relates to:** Chat interface, widget slots

### 5. Horizon AI Boilerplate — ShadCN Chat Admin
- **File:** `shadcn-ai-chat-horizon-dashboard-01.png`
- **Source:** https://github.com/horizon-ui/shadcn-nextjs-boilerplate
- **What's notable:** Open-source ChatGPT-style admin dashboard built with ShadCN/ui and Next.js. Shows how a chat interface can coexist with an admin sidebar, settings pages, and usage metrics in one app. Directly relevant stack.
- **Relates to:** Chat interface, admin/settings, ShadCN theming

---

## Category 2: Smart Home Dashboards (Widget Slot Pattern)

### 6. Home Assistant — Mushroom Cards (Sections Layout)
- **File:** `smart-home-mushroom-sections-01.png`
- **Source:** https://www.michaelsleen.com/dashboard-update/
- **What's notable:** Mushroom Cards using the new Sections view layout. Drag-and-drop modular cards, each card being a self-contained device control widget. Material Design aesthetic with full dark/light support. The card-per-entity model is the closest existing pattern to "dynamic widget slots."
- **Relates to:** Widget slots, smart home controls

### 7. Home Assistant — Mushroom Cards Dark (Conditional)
- **File:** `smart-home-mushroom-conditional-01.png`
- **Source:** https://www.michaelsleen.com/dashboard-update/
- **What's notable:** Dark-themed mushroom cards with conditional visibility. Widgets show/hide based on state. Demonstrates the "active widget" concept — only showing controls relevant to current context.
- **Relates to:** Widget slots, dark theming

### 8. Home Assistant — Mushroom Dark Layout
- **File:** `smart-home-mushroom-dark-01.png`
- **Source:** https://www.michaelsleen.com/dashboard-update/
- **What's notable:** Full dark implementation of mushroom card layout. Subdued card backgrounds, colored icon accents for state feedback. Shows how device type cards (light, climate, media, security) coexist in a single grid view.
- **Relates to:** Widget slots, dark theming

### 9. Home Assistant — Bruno Sabot 2025 Dashboard
- **File:** `smart-home-ha-dashboard-2025-01.png`
- **Source:** https://brunosabot.dev/posts/2025/home-assistant-dashboard-evolution-streamlined-stunning-in-2025/
- **What's notable:** 2025 evolution of a production Home Assistant setup. Streamlined card-based UI with animated media player, thermostat, and battery widgets. The media player widget with album art + controls is directly applicable to our YouTube Music plugin widget.
- **Relates to:** Widget slots, music player widget

### 10. Streamline Cards — Template Collection
- **File:** `smart-home-streamline-cards-01.png`
- **Source:** https://brunosabot.dev/posts/2025/home-assistant-dashboard-evolution-streamlined-stunning-in-2025/
- **What's notable:** Pre-designed Bubble Card templates: weather card, thermostat ring, battery indicator, shutter position — each a compact self-contained control unit. The template system concept applies directly to our reusable widget components.
- **Relates to:** Widget slots

### 11. Animated Media Player Widget
- **File:** `smart-home-media-player-widget-01.gif`
- **Source:** https://brunosabot.dev/posts/2025/home-assistant-dashboard-evolution-streamlined-stunning-in-2025/
- **What's notable:** Animated thumbnail + play/pause/skip controls within a card-sized widget. Album art as background, translucent overlay for controls. This is exactly the design direction for the YouTube Music plugin widget slot.
- **Relates to:** Widget slots, music player widget

---

## Category 3: Modular / Bento Grid Layouts

### 12. Bento Grid — Minimal Typography
- **File:** `bento-grid-minimal-01.png`
- **Source:** https://mockuuups.studio/blog/post/best-bento-grid-design-examples/
- **What's notable:** Bold typography within tight grid cells. Shows how text-heavy information can be organized into scannable bento modules. Relevant for plugin status cards or usage metric tiles.
- **Relates to:** Widget slots, admin views

### 13. Bento Grid — Apple Storytelling Style
- **File:** `bento-grid-apple-storytelling-01.png`
- **Source:** https://mockuuups.studio/blog/post/best-bento-grid-design-examples/
- **What's notable:** Apple's feature grid approach: large hero cell + smaller supporting cells. Different cell sizes convey hierarchy. The primary chat interface could be the hero cell, with widget slots as the smaller surrounding tiles.
- **Relates to:** Widget slots, overall layout

### 14. Bento Grid — Responsive Adaptation
- **File:** `bento-grid-responsive-01.png`
- **Source:** https://mockuuups.studio/blog/post/best-bento-grid-design-examples/
- **What's notable:** Shows the same bento layout adapting across device sizes. Key principle: cells reflow/stack on mobile while maintaining identity. Useful for designing the widget slot system to be responsive.
- **Relates to:** Widget slots, responsive design

### 15. Bento Grid — Procreate Five-Cell
- **File:** `bento-grid-procreate-01.png`
- **Source:** https://mockuuups.studio/blog/post/best-bento-grid-design-examples/
- **What's notable:** Five-cell layout with one spanning wide cell + four smaller cells. Clear visual rhythm, art-focused content. Demonstrates the 1-big + N-small layout pattern.
- **Relates to:** Widget slots, overall layout

### 16. Widget/Modular Dashboard Trends
- **File:** `widget-modular-dashboard-trends-01.png`
- **Source:** https://uitop.design/blog/design/top-dashboard-design-trends/
- **What's notable:** Curated example of 2025 modular widget dashboard design trend. Drag-and-drop customizable widgets with distinct card boundaries and data visualization within each widget.
- **Relates to:** Widget slots, admin views

---

## Category 4: Dark Mode with Depth

### 17. Linear App — Redesigned Dark UI (After)
- **File:** `dark-ui-linear-redesign-after-01.png`
- **Source:** https://linear.app/now/how-we-redesigned-the-linear-ui
- **What's notable:** Linear's 2024 UI redesign result: tight information density, inverted-L navigation, LCH color space for perceptual consistency, variable contrast support. Near-black background with minimal color accents. The "boring and perfect" professional aesthetic that engineers trust.
- **Relates to:** Dark theming, admin layout

### 18. Linear App — Dark Theme Showcase
- **File:** `dark-ui-linear-dark-theme-01.png`
- **Source:** https://linear.app/now/how-we-redesigned-the-linear-ui
- **What's notable:** Side-by-side light/dark theme. The dark version uses white at 5-30% opacity for surface hierarchy rather than distinct gray values. No heavy shadows — elevation conveyed through opacity layering. Directly applicable to our dark glassmorphism direction.
- **Relates to:** Dark theming

### 19. Linear App — Views Panel
- **File:** `dark-ui-linear-views-01.png`
- **Source:** https://linear.app/now/how-we-redesigned-the-linear-ui
- **What's notable:** Dense list views with the redesigned UI. Shows how sidebar, toolbar, and content area interact in the dark theme. Sidebar uses very subtle dividers — no hard lines, just opacity contrast.
- **Relates to:** Dark theming, admin layout

### 20. Dark Mode Dashboard Trends 2025
- **File:** `dark-mode-dashboard-trends-01.png`
- **Source:** https://uitop.design/blog/design/top-dashboard-design-trends/
- **What's notable:** Curated 2025 dark dashboard design trend example. Shows the standard: deep background, high-contrast accent color for active elements, glass-like card surfaces.
- **Relates to:** Dark theming

### 21. Private Cloud Admin Dashboard (Dark)
- **File:** `dark-ui-cloud-admin-dashboard-01.jpg`
- **Source:** https://superdevresources.com/dark-ui-inspiration/
- **What's notable:** Admin/server management dashboard in dark UI. Cyan color accents for data visualization. Background shading to convey widget card depth. The color palette and density feel closest to our "server management" widget slot use case.
- **Relates to:** Dark theming, admin/settings, widget slots

### 22. Task Manager — Dark UI
- **File:** `dark-ui-task-manager-01.jpg`
- **Source:** https://superdevresources.com/dark-ui-inspiration/
- **What's notable:** Strong contrast dark dashboard for project/task management. Well-organized layout with left sidebar, main content, right detail panel. Three-panel layout directly applicable to chat + widgets + settings.
- **Relates to:** Dark theming, admin layout

### 23. Cryptocurrency Analytics — Dark with Glass
- **File:** `dark-ui-crypto-analytics-01.jpg`
- **Source:** https://superdevresources.com/dark-ui-inspiration/
- **What's notable:** Minimal foreground colors, subtle background shading, glass card effects for visual hierarchy. Demonstrates how glassmorphism works when restrained — used for cards, not as a global effect.
- **Relates to:** Dark theming, analytics views

### 24. Analytics Dashboard Dark (Felix)
- **File:** `dark-analytics-dashboard-felix-01.jpg`
- **Source:** https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/
- **What's notable:** Soft gradients + bold typography + clear visual hierarchy on a dark background. Shows the "ambient glow" technique: colored gradient orbs behind dark cards create atmospheric depth without glassmorphism.
- **Relates to:** Dark theming, analytics views

### 25. SaaS Dashboard — Lavender Dark
- **File:** `dark-saas-telecom-lavender-01.png`
- **Source:** https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/
- **What's notable:** Deep dark aesthetic with lavender/purple accent colors. Smooth data visualization, compact sidebar navigation. The purple accent palette aligns well with an AI-native product's visual identity.
- **Relates to:** Dark theming, analytics views

### 26. Cybersecurity Dashboard (AI-Powered)
- **File:** `dark-cybersecurity-dashboard-01.png`
- **Source:** https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/
- **What's notable:** Dark data-driven aesthetic with precise green accents. AI-powered threat monitoring dashboard — shows how "system status" data (analogous to our agent run metrics) can be displayed with real-time feel using minimal color but high information density.
- **Relates to:** Dark theming, analytics views, admin

### 27. Energy Management — Dark + 3D
- **File:** `dark-energy-management-3d-01.png`
- **Source:** https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/
- **What's notable:** Blends data visualization with architectural 3D elements. Dark background with solar/energy data panels. Example of how to make a dashboard feel spatial and immersive without sacrificing usability.
- **Relates to:** Dark theming, widget slots

### 28. Admin UI — Clean Spacing Dark
- **File:** `dark-admin-ui-clean-spacing-01.jpg`
- **Source:** https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/
- **What's notable:** Balances clarity with energy through soft color palette and clean spacing on dark background. Good reference for the admin/settings pages — not too dense, not too minimal.
- **Relates to:** Dark theming, admin/settings

### 29. IoT SaaS Dashboard Phoenix
- **File:** `iot-saas-dashboard-phoenix-01.png`
- **Source:** https://muz.li/blog/top-dashboard-design-examples-inspirations-for-2025/
- **What's notable:** IoT monitoring dashboard with device status cards, sensor readings, and system state widgets. Multiple device types coexisting in one view. Strong analogue for the plugin management view where each plugin = a device card.
- **Relates to:** Plugin management, widget slots

### 30. Statistics Dashboard Dark
- **File:** `statistics-dashboard-dark-01.png`
- **Source:** https://muz.li/blog/top-dashboard-design-examples-inspirations-for-2025/
- **What's notable:** Metrics visualization with compact stats cards and chart areas. Shows how to surface key numbers (token counts, API calls, costs) in a dark analytics view.
- **Relates to:** Analytics/usage views, dark theming

### 31. Analytics Dashboard Dark (Nixtio)
- **File:** `analytics-dashboard-dark-01.png`
- **Source:** https://muz.li/blog/top-dashboard-design-examples-inspirations-for-2025/
- **What's notable:** Data visualization with colored chart elements on dark background. Modular widget structure. Each chart/metric in its own card with consistent padding.
- **Relates to:** Analytics/usage views

---

## Category 5: ShadCN-Based Production Apps

### 32. ShadCN Admin Dashboard (Vercel Template)
- **File:** `shadcn-admin-dashboard-vercel-template-01.png`
- **Source:** https://vercel.com/templates/next.js/next-js-and-shadcn-ui-admin-dashboard
- **What's notable:** Official Vercel-hosted Next.js + ShadCN admin template. Collapsible sidebar, light/dark mode, customizable color presets (Tangerine, Neo Brutalism, Soft Pop). Production-quality reference for how ShadCN components look in a full admin app.
- **Relates to:** ShadCN theming, admin/settings

### 33. ShadCN Admin Dashboard (arhamkhnz)
- **File:** `shadcn-admin-dashboard-arhamkhnz-01.png`
- **Source:** https://github.com/arhamkhnz/next-shadcn-admin-dashboard
- **What's notable:** Next.js 16 + Tailwind CSS v4 + ShadCN admin template. Multiple dashboard variants (Default, CRM, Finance). Collapsible sidebar with flexible content widths. Custom theme presets. Shows how far ShadCN can be pushed from its default aesthetic.
- **Relates to:** ShadCN theming, admin/settings

### 34. ShadCN Dashboard Starter (Kiranism)
- **File:** `shadcn-nextjs-dashboard-starter-01.png`
- **Source:** https://github.com/Kiranism/next-shadcn-dashboard-starter
- **What's notable:** Open-source production-ready starter with analytics overview, data tables, 6+ themes, server-side pagination. The cleanest available reference for ShadCN component composition in a real app context.
- **Relates to:** ShadCN theming, analytics views

### 35. ShadCN Admin (satnaing/Vite)
- **File:** `shadcn-admin-vite-dashboard-01.png`
- **Source:** https://github.com/satnaing/shadcn-admin
- **What's notable:** Admin dashboard with global search command palette (Cmd+K), sidebar, light/dark mode, RTL support. The command palette integration is directly relevant to the planned Cmd+K feature (Backlog #15). Shows the palette sitting within the dark admin chrome.
- **Relates to:** ShadCN theming, admin/settings, command palette

---

## Additional Reference-Only Entries (No Local File — CDN Accessible)

### 36. Material Design 3 Dynamic Dashboard (ElementZoom)
- **File:** URL only — https://github.com/ElementZoom/Material-Design-3-Dynamic-Mobile-Dashboard
- **What's notable:** Transparent card layouts, dynamic color system, swipeable room sections with up to 4 quick-action buttons per card. Full dark/light adaptation. The "4 quick actions per card" pattern = directly applicable to plugin card controls (enable/disable/settings/logs).
- **Relates to:** Widget slots, plugin management, dark theming

### 37. Horizon AI ShadCN Boilerplate Banner
- **File:** `shadcn-ai-chat-horizon-dashboard-02.png` (19KB — loading image, not useful)
- **Source:** https://github.com/horizon-ui/shadcn-nextjs-boilerplate
- **Notes:** The banner image is small. Full dashboard in file #5 above.
- **Relates to:** Chat interface, ShadCN theming

---

## Design Pattern Synthesis

### Patterns appearing across 3+ examples:

1. **Ambient gradient orbs behind dark cards** — Used by Linear, dark analytics dashboards, crypto dashboards. Not full glassmorphism — just colored gradients visible through card surfaces at low opacity.

2. **Three-panel layout** — Sidebar nav + main content + right detail/context panel. Seen in Promptly, task managers, Otter.ai. Maps directly to our left nav + chat + widget panel.

3. **Card-per-entity widget grid** — Each device/plugin/tool gets its own contained card with a title, status indicator, and 2-4 action buttons. Home Assistant + IoT dashboards + plugin management UIs all use this.

4. **Collapsible left sidebar** — All production ShadCN dashboards use this. 60px icon-only collapsed state, full 220-260px expanded. Keyboard shortcut to toggle.

5. **LCH color space for dark themes** — Linear explicitly documents using LCH (not HSL) so perceived brightness stays consistent across hues. Relevant if we build a theme generator.

6. **Fire-and-forget status cards** — Cybersecurity/IoT dashboards show live status as colored dot + label + last-updated timestamp. Directly applicable to AgentRun status cards and plugin health cards.

### Unique patterns worth adopting:

- **Bubble Card pop-up model** (Home Assistant): Widgets are collapsed to icon-buttons by default, expand to full control surface on click. Could work for music player, timer, and smart home widgets.
- **Split-screen chat + assembly** (Accern Rhea): Chat on left, structured output on right. Alternative to right-panel widget approach.
- **"Ambient glow" depth** (dark analytics dashboards): Instead of glassmorphism, use 2-3 colored radial gradients as background elements behind dark cards. Lower performance cost, same atmospheric effect.

---

## Sources

| # | Source | URL |
|---|--------|-----|
| 1 | Lazarev Agency — AI Dashboard Design | https://www.lazarev.agency/articles/ai-dashboard-design |
| 2 | Behance — Promptly Dark Mode | https://www.behance.net/gallery/227751367/Promptly-AI-Powered-Chatbot-UI-Design-(Dark-Mode) |
| 3 | GitHub — Horizon AI ShadCN Boilerplate | https://github.com/horizon-ui/shadcn-nextjs-boilerplate |
| 4 | michaelsleen.com — HA Dashboard 2025 | https://www.michaelsleen.com/dashboard-update/ |
| 5 | brunosabot.dev — HA Evolution 2025 | https://brunosabot.dev/posts/2025/home-assistant-dashboard-evolution-streamlined-stunning-in-2025/ |
| 6 | mockuuups.studio — Bento Grid Examples | https://mockuuups.studio/blog/post/best-bento-grid-design-examples/ |
| 7 | uitop.design — Dashboard Trends 2025 | https://uitop.design/blog/design/top-dashboard-design-trends/ |
| 8 | linear.app — UI Redesign | https://linear.app/now/how-we-redesigned-the-linear-ui |
| 9 | superdevresources.com — Dark UI | https://superdevresources.com/dark-ui-inspiration/ |
| 10 | muz.li — Dashboard Examples 2026 | https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/ |
| 11 | muz.li — Dashboard Examples 2025 | https://muz.li/blog/top-dashboard-design-examples-inspirations-for-2025/ |
| 12 | Vercel Templates — ShadCN Dashboard | https://vercel.com/templates/next.js/next-js-and-shadcn-ui-admin-dashboard |
| 13 | GitHub — arhamkhnz admin dashboard | https://github.com/arhamkhnz/next-shadcn-admin-dashboard |
| 14 | GitHub — Kiranism dashboard starter | https://github.com/Kiranism/next-shadcn-dashboard-starter |
| 15 | GitHub — satnaing shadcn-admin | https://github.com/satnaing/shadcn-admin |
| 16 | GitHub — ElementZoom MD3 Dashboard | https://github.com/ElementZoom/Material-Design-3-Dynamic-Mobile-Dashboard |
| 17 | eleken.co — Chatbot UI Examples | https://www.eleken.co/blog-posts/chatbot-ui-examples |
| 18 | arounda.agency — Chatbot UI Examples | https://arounda.agency/blog/chatbot-ui-examples |
| 19 | tweakcn.com — ShadCN Theme Editor | https://tweakcn.com/ |
| 20 | bentogrids.com — Bento Gallery | https://bentogrids.com/ |
