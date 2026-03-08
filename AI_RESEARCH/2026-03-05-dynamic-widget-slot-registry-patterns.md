# Research: Dynamic Widget Slot/Registry Patterns for Plugin Dashboards

Date: 2026-03-05

## Summary

Research into how modern dashboards implement dynamic slot/widget systems where components register themselves, render dynamically, and swap based on priority or context. Focus on architectures where backend plugins can register UI widgets that the frontend renders without knowing each plugin in advance. Applicable to the Harness orchestrator dashboard (Next.js 16 + React 19 + ShadCN).

## Prior Research

- `2026-02-26-dynamic-plugin-ui-loading-nextjs.md` — covers loading plugin *settings pages* via `next/dynamic`. Related but distinct problem.

---

## Research Area 1: Widget Registry Patterns (Platform Examples)

### Home Assistant Lovelace — Web Components Registry

**Source (PRIMARY):** https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/

**Architecture:** Pure Web Components API. No React involved, but the pattern is maximally transferable.

**Registration mechanism:**
```javascript
// 1. Define a custom element
customElements.define('my-widget', MyWidgetClass);

// 2. Register metadata in a global array
window.customCards = window.customCards || [];
window.customCards.push({
  type: "my-widget",        // maps to the custom element name
  name: "My Widget",
  description: "Does X",
});
```

**Type resolution flow (PRIMARY source: DeepWiki Lovelace UI Framework):**
```
YAML config: { type: "my-widget", entity: "sensor.foo" }
     ↓
Card registry lookup: "my-widget" → customElements.get("my-widget")
     ↓
createElement("my-widget")
     ↓
setConfig(config)          // pass YAML properties to the element
     ↓
Rendered card
```

Source: https://deepwiki.com/home-assistant/frontend/3-lovelace-ui-framework

**Key insight:** The `type` string IS the lookup key. Custom cards use prefix `custom:my-card-name`. Built-in cards use unprefixed names. The registry is a global singleton (`window.customCards` + `customElements`).

**RSC compatibility:** NOT compatible — this is browser-only Web Components. Pure client pattern.

---

### Grafana — Plugin Extension Points (Push/Pull Model)

**Source (PRIMARY):** https://grafana.com/developers/plugin-tools/how-to-guides/ui-extensions/ui-extensions-concepts

**Architecture:** Grafana uses a React hook-based registry (`usePluginExtensions`, `usePluginLinks`) backed by a server-side registry.

**Two distinct patterns:**

**Push (add):** Producer decides WHERE content appears. Plugin registers to a known slot ID:
```typescript
// In the plugin's module.ts:
export const plugin = new AppPlugin().addLink({
  title: 'My Action',
  targets: ['grafana/dashboard/panel/menu/v1'],  // named slot
  path: `/a/${pluginJson.id}/details`,
  configure: (context) => {
    // Return undefined to hide, {} to show
    return context?.panelId ? {} : undefined;
  },
});
```

**Pull (expose):** Producer makes component available; consumer decides IF and HOW to render:
```typescript
// Producer exposes a component
export const plugin = new AppPlugin().exposeComponent({
  id: 'myorg-foo-app/MySpecialWidget/v1',
  title: 'My Widget',
  description: 'A reusable widget',
  component: ({ context }) => <MyWidget data={context} />,
});
```

**Consumer (slot/extension point) side:**
```typescript
// Source (PRIMARY): https://grafana.com/developers/plugin-tools/how-to-guides/ui-extensions/create-an-extension-point
import { usePluginLinks } from '@grafana/runtime';

export const InstanceToolbar = () => {
  const extensionPointId = 'myorg-foo-app/toolbar/v1';
  const context = useMemo(() => ({ instanceId }), [instanceId]);
  const { links, isLoading } = usePluginLinks({ extensionPointId, context });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {links.map(({ id, title, path, onClick }) => (
        <a href={path} title={title} key={id} onClick={onClick}>
          {title}
        </a>
      ))}
    </div>
  );
};
```

**Extension point declaration (in plugin.json):**
```json
{
  "extensions": {
    "extensionPoints": [
      { "id": "myorg-foo-app/toolbar/v1" }
    ]
  }
}
```

**Key insight:** Slot IDs are namespaced strings (`org-plugin/slot-name/v1`). The `usePluginLinks` hook queries a client-side registry that was populated during plugin load via SystemJS. `limitPerPlugin`, filtering by `pluginId`, and `context` objects allow fine-grained control.

**RSC compatibility:** NOT compatible — uses React hooks. Entirely client-side. Grafana loads plugins via SystemJS at runtime from remote URLs.

Source: https://grafana.com/developers/plugin-tools/reference/ui-extensions-reference/ui-extensions

---

### Backstage — Extension Tree System

**Source (PRIMARY):** https://backstage.io/docs/frontend-system/architecture/extensions/
**Source (PRIMARY):** https://backstage.io/docs/plugins/composability/

**Architecture:** A hierarchical extension tree where every UI element is an "extension" that attaches to a parent via typed data refs. No global registry — instead, a compile-time extension tree resolved at app startup.

**Extension data references (typed communication):**
```typescript
// Type-safe data channel between parent and child extensions
export const reactElementExtensionDataRef =
  createExtensionDataRef<React.JSX.Element>().with({
    id: 'my-plugin.reactElement',
  });
```

**How a plugin contributes a card (Component Extension):**
```typescript
// In the plugin package:
export const EntityFooCard = advicePlugin.provide(
  createComponentExtension({
    name: 'AdviceCard',
    component: {
      lazy: () => import('./components/AdviceCard').then(m => m.AdviceCard),
    },
  }),
);
```

**How extensions attach to slots (parent inputs):**
```typescript
const child = createExtension({
  attachTo: { id: 'app/nav', input: 'items' },  // slot = parent ID + input name
  output: [coreExtensionData.reactElement],
  factory() {
    return [coreExtensionData.reactElement(<NavItem />)];
  },
});
```

**Parent consumes children:**
```typescript
factory({ inputs }) {
  return [
    coreExtensionData.reactElement(
      <nav>
        {inputs.items.map(item => (
          <li>{item.get(coreExtensionData.reactElement)}</li>
        ))}
      </nav>,
    ),
  ];
}
```

**Error isolation:** Each extension is wrapped in `<ExtensionBoundary>` which provides Suspense + ErrorBoundary per plugin — plugin crashes don't bring down the dashboard.

**Key insight:** Backstage resolves the extension tree at app init time (not runtime), which means this is a build-time composition model, not a true runtime registry. The `attachTo` declaration is static. However, the `createComponentExtension` lazy-loading pattern IS useful for deferred bundle loading.

**RSC compatibility:** NOT compatible directly — uses React context and hooks internally. However, the lazy component pattern works in Next.js client components.

---

### GoodData — Dashboard Plugin API (Most Relevant Production Example)

**Source (PRIMARY):** https://www.gooddata.com/docs/gooddata-ui/latest/references/dashboard_component/dashboard_plugins_api/

**Architecture:** Closest to what Harness needs. Plugins register React components for named widget types, and the dashboard renders them by type lookup.

**Plugin lifecycle:**
```javascript
class MyPlugin extends DashboardPluginV1 {
  // Called after plugin loads — access backend context here
  onPluginLoaded(ctx) { ... }

  // Mandatory: register customizations here
  register(ctx, customize, eventHandlers) {
    // Register a React component for a custom widget type
    customize.customWidgets().addCustomWidget(
      "myCustomWidget",        // widget type string (the registry key)
      MyReactComponent         // the React component to render
    );

    // Insert a widget instance into the layout
    customize.layout().customizeFluidLayout((_layout, customizer) => {
      customizer.addSection(
        newDashboardSection(
          newDashboardItem(newCustomWidget("id1", "myCustomWidget"))
        )
      );
    });
  }

  // Optional cleanup
  onPluginUnload() { ... }
}
```

**Key insight:** `addCustomWidget(typeString, Component)` is the registration API. Type strings are the lookup keys. Multiple plugins can register different widget types. Widgets receive `IDashboardWidgetProps` with the widget configuration payload.

**RSC compatibility:** NOT compatible — GoodData plugins are React-class based client code.

---

### Dazzle — Declarative Widget Registry (Simple Open Source)

**Source (SECONDARY — GitHub README):** https://github.com/Raathigesh/dazzle

**Architecture:** Static widget registry passed as props to a `<Dashboard>` component.

```javascript
// Static registry: type key → React component
const widgets = {
  TodoList: {
    type: TodoListComponent,    // React component
    title: 'My Todo List',
  },
  WeatherWidget: {
    type: WeatherComponent,
    title: 'Weather',
  },
};

// Layout references registry keys
const layout = {
  rows: [{
    columns: [{
      className: 'col-md-6',
      widgets: [{ key: 'TodoList' }]  // key lookup into registry
    }]
  }]
};

<Dashboard widgets={widgets} layout={layout} />
```

**Key insight:** The `key` field in layout entries is a string lookup into the `widgets` registry object. This is the simplest possible form of the type-map pattern. Static, not dynamic. Good reference for the core lookup mechanism.

---

## Research Area 2: Schema-Driven UI Rendering

**Source (PRIMARY):** https://rjsf-team.github.io/react-jsonschema-form/docs/usage/widgets/
**Source (PRIMARY):** https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-widgets-fields/

**Core pattern:** Backend sends JSON schema + `uiSchema`. The `uiSchema` uses `ui:widget` to specify which registered widget renders a field:

```json
{
  "uiSchema": {
    "myField": {
      "ui:widget": "MyCustomWidget"
    }
  }
}
```

Frontend maps widget names to components:
```typescript
const widgets = {
  MyCustomWidget: MyCustomWidgetComponent,
  // ...
};

<Form schema={schema} uiSchema={uiSchema} widgets={widgets} />
```

**Visitor pattern variant (Source: SECONDARY):**
Source: https://www.arahansen.com/react-design-patterns-generating-user-configured-ui-using-the-visitor-pattern/

```typescript
// Registry: field type → React component
const defaultComponents = {
  Text:   () => <input type="text" />,
  Date:   () => <input type="date" />,
  Number: () => <input type="number" />,
};

// Rendering engine (visits schema, dispatches to registry)
function ViewGenerator({ schema, components }) {
  const mergedComponents = { ...defaultComponents, ...components };

  return schema.map((field) => {
    const children = field.children
      ? <ViewGenerator schema={field.children} components={mergedComponents} />
      : null;
    return mergedComponents[field.fieldType]({ ...field, children });
  });
}
```

**Key insight:** The schema describes WHAT to render (type, config), the registry describes HOW to render it (component). The backend owns the schema; the frontend owns the component map. New widget types require adding to the component map but NOT changing the rendering engine.

**Function Registry Pattern (Source: SECONDARY):**
Source: https://techhub.iodigital.com/articles/function-registry-pattern-react

```typescript
interface Transformer {
  name: string;
  canHandle: (props: unknown) => boolean;  // predicate
  transform: (props: any, registry: TransformRegistry) => ReactElement;
}

const transformers: Transformer[] = [];

export const registerTransformer = (transformer: Transformer) => {
  transformers.push(transformer);  // order matters — first match wins
};

// Dispatcher
export const createTransformRegistry = (): TransformRegistry => {
  const registry: TransformRegistry = (params) => {
    const transformer = transformers.find(t => t.canHandle(params));
    return transformer
      ? transformer.transform(params, registry)  // recursive, for nested types
      : createDefaultField(params);
  };
  return registry;
};
```

**Key insight:** `canHandle` predicate instead of exact key match enables richer dispatch (e.g., match on multiple conditions, fallback chain). The registry is a module-level singleton; new widget types are added by calling `registerTransformer()` before the renderer is invoked.

---

## Research Area 3: Micro-Frontend Patterns

**Source (PRIMARY):** https://webpack.js.org/concepts/module-federation/
**Source (SECONDARY):** https://blog.logrocket.com/solving-micro-frontend-challenges-module-federation/

**Architecture:** Webpack 5 Module Federation allows JavaScript applications to share code and load remote modules at runtime. Each widget/plugin team builds independently and exposes components via a `ModuleFederationPlugin`.

**Host (dashboard) configuration:**
```javascript
// webpack.config.js
new ModuleFederationPlugin({
  name: 'shell',
  remotes: {
    pluginA: 'pluginA@https://cdn.example.com/pluginA/remoteEntry.js',
    pluginB: 'pluginB@https://cdn.example.com/pluginB/remoteEntry.js',
  },
  shared: ['react', 'react-dom'],
});
```

**Dynamic loading in React:**
```typescript
const RemoteWidget = React.lazy(() =>
  import('pluginA/Widget').then(m => ({ default: m.Widget }))
);

<Suspense fallback={<Skeleton />}>
  <RemoteWidget />
</Suspense>
```

**Key insight for Harness:** Module Federation requires separate build processes per plugin and remote URL infrastructure. This is heavy machinery for an internal monorepo where plugins are co-located in the same repo. The `next/dynamic` approach (already researched in prior doc) achieves similar deferred loading within a monorepo without federation.

**RSC compatibility:** NOT compatible natively. Module Federation components are always client-side. Dynamic imports from RSC are bundled into the initial client bundle even if not rendered (GitHub issue: https://github.com/vercel/next.js/issues/61066).

**Verdict:** Overkill for same-repo plugins. Use Module Federation only when plugin teams are truly independent and deploy separately.

---

## Research Area 4: Slot/Portal Patterns in React

### WordPress Gutenberg SlotFill — Production Reference Implementation

**Source (PRIMARY):** https://developer.wordpress.org/block-editor/reference-guides/components/slot-fill/
**Source (SECONDARY — architecture):** https://nickdiego.com/a-primer-on-wordpress-slotfill-technology/

**Architecture:** SlotFillProvider creates a React context that acts as a singleton registry. Slot defines a named hole; Fill injects content into it regardless of DOM position.

```jsx
// Root: wrap app in provider
<SlotFillProvider>
  <App />
</SlotFillProvider>

// In layout component: define the slot (extension point)
const Toolbar = () => (
  <div className="toolbar">
    <Slot name="Toolbar" />
  </div>
);

// In any plugin component: fill the slot
const PluginToolbarItem = () => (
  <Fill name="Toolbar">
    <button>Plugin Action</button>
  </Fill>
);
```

**Helper that co-locates Slot and Fill:**
```javascript
const { Fill, Slot } = createSlotFill('MyWidget');
```

**Passing context from Slot to Fill (fillProps):**
```javascript
// Slot passes data down to fills
<Slot name="Toolbar" fillProps={{ hideToolbar }} />

// Fill receives the props
<Fill name="Toolbar">
  {({ hideToolbar }) => <Button onClick={hideToolbar}>Hide</Button>}
</Fill>
```

**Conditional rendering (no fills = hide container):**
```javascript
<Slot name="Toolbar">
  {(fills) => fills.length > 0 ? <div className="toolbar">{fills}</div> : null}
</Slot>
```

**RSC compatibility:** NOT compatible — uses React context and state internally. Must be client component.

**Key insight:** SlotFill is the most battle-tested named-slot pattern for React plugin systems. Used by WordPress (hundreds of plugins). The key design principle: Slot is owned by the layout, Fill is owned by the plugin, and SlotFillProvider's context is the registry.

---

### @grlt-hub/react-slots — Modern Declarative Slots with Effector

**Source (PRIMARY):** https://github.com/grlt-hub/react-slots

```typescript
// Define slots (in layout/core code)
const { slotsApi, Slots } = createSlots({
  Toolbar:  createSlotIdentifier<{ currentUser: User }>(),
  Sidebar:  createSlotIdentifier<{ collapsed: boolean }>(),
} as const);

// Plugin registers into a slot (from anywhere)
slotsApi.Toolbar.insert({
  Component: ({ currentUser }) => <UserBadge user={currentUser} />,
  order: 10,  // lower = renders first
});

// Conditional/deferred insert
slotsApi.Sidebar.insert({
  when: someEffectorEvent,   // fires when event triggers
  Component: (props) => <SidebarWidget {...props} />,
});

// Layout renders the slot
<Slots.Toolbar />  // renders all registered components, passing typed props
```

**Key insight:** Type-safe slot props, ordered rendering, deferred insertion, and clearing. Backed by Effector for reactive state — this means slot contents update reactively when `slotsApi` is called. Works well for runtime plugin registration.

**RSC compatibility:** NOT compatible — client-side React hooks + Effector store.

---

### react-portalslots — Portal-Based Named Slots

**Source (SECONDARY — DEV Community):** https://dev.to/devall/react-portalslots-2637

```javascript
// Define named portal slots
const HeaderPortal = PortalSlot('header');
const FooterPortal = PortalSlot('footer');

// Layout renders slot targets
const Layout = () => (
  <>
    <HeaderPortal.Slot />
    <main><Outlet /></main>
    <FooterPortal.Slot />
  </>
);

// Plugin injects content from anywhere in tree
const PluginHeader = () => (
  <HeaderPortal>
    <nav>Plugin Navigation</nav>
  </HeaderPortal>
);
```

**RSC compatibility:** NOT compatible — uses React Portals (browser DOM API).

---

## Research Area 5: Next.js 16 / React 19 Constraints for Widget Systems

**Source (PRIMARY):** https://nextjs.org/blog/next-16
**Source (PRIMARY):** https://nextjs.org/docs/app/getting-started/server-and-client-components

### Critical Constraints

1. **Dynamic widget registries MUST be client-side.** A registry that holds React components cannot live in a Server Component because:
   - Server Components cannot use `useState`, `useContext`, `createContext`
   - React component functions cannot be serialized across the server→client boundary
   - The registry needs to be mutable at runtime (client-side registration)

2. **`next/dynamic` from a Server Component does NOT code-split.** When a Server Component imports a client component via `next/dynamic`, Next.js includes it in the initial client bundle regardless (GitHub issue confirmed: https://github.com/vercel/next.js/issues/61066). True code-splitting only works when `dynamic()` is called from within a Client Component.

3. **The server can provide configuration (widget layout descriptor), not component references.** Server can return JSON describing WHICH widgets to show (plugin name, widget type, config props). The client registry maps those strings to actual React components.

4. **React 19.2 `<Activity>` component** is new in Next.js 16 and can be used to keep widget state alive while hiding them (useful for widget systems with tab-switching). Source: https://nextjs.org/blog/next-16

5. **Next.js 16 `"use cache"` directive** allows caching widget layout configuration from the server, useful for dashboards where widget layout is loaded from a database but doesn't change per-request.

### Pattern That Works in Next.js 16 App Router

```
Server Component (RSC):
  - Fetches widget layout from DB: [{ type: "MetricsWidget", config: {...} }, ...]
  - Passes serializable config (strings, numbers, plain objects) to Client Component

Client Component (with "use client"):
  - Holds the widget registry: Map<string, React.ComponentType>
  - Receives layout from Server Component as props
  - Renders: layout.map(item => { const Widget = registry.get(item.type); return <Widget {...item.config} /> })
```

---

## Synthesis: The Best Pattern for Harness

### Core Question
What is the best architectural pattern for a plugin system where backend plugins can register UI widgets that the frontend renders dynamically, without the frontend needing to know about each plugin in advance?

### Answer: Client-Side Type-Map Registry + Server-Provided Layout Descriptor

This is the convergent pattern across all studied systems (Dazzle, GoodData, Home Assistant, Visitor pattern, Schema-Driven UI). The specific form optimal for Next.js 16:

**Step 1 — Server provides a layout descriptor (serializable JSON)**

A Next.js Server Component fetches widget configuration from a database or API endpoint. Each plugin/backend can write widget records to the DB. The server does NOT send React components — only strings and plain data:

```typescript
// Server Component fetches from DB
type WidgetDescriptor = {
  id: string;
  type: string;       // "MetricsWidget" | "ThreadActivity" | "CronStatus"
  config: Record<string, unknown>;  // serializable plugin-specific config
  slot: string;       // "main" | "sidebar" | "header"
  order: number;
  width: "full" | "half" | "quarter";
};

const widgets = await db.dashboardWidget.findMany({ where: { enabled: true } });
```

**Step 2 — Client holds the registry (static import map)**

The registry is a static map in client code. The frontend must know which widget types EXIST (as imports), but does not need to know WHICH plugins are enabled — that's determined at runtime by the server descriptor:

```typescript
// "use client"
import type { FC } from 'react';

// Static registry — all possible widget types
const WIDGET_REGISTRY = new Map<string, FC<any>>([
  ['MetricsWidget',    () => import('./widgets/metrics-widget')],
  ['ThreadActivity',   () => import('./widgets/thread-activity-widget')],
  ['CronStatus',       () => import('./widgets/cron-status-widget')],
  ['AgentMemoryUsage', () => import('./widgets/agent-memory-widget')],
]);
```

**Step 3 — Renderer looks up by type and renders**

```typescript
// "use client"
const WidgetRenderer = ({ descriptor }: { descriptor: WidgetDescriptor }) => {
  const WidgetComponent = WIDGET_REGISTRY.get(descriptor.type);

  if (!WidgetComponent) {
    return <UnknownWidgetFallback type={descriptor.type} />;
  }

  return (
    <Suspense fallback={<WidgetSkeleton />}>
      <WidgetComponent {...descriptor.config} />
    </Suspense>
  );
};
```

**Why this pattern wins:**
- Server controls WHICH widgets are active (DB-driven, plugin-managed)
- Frontend controls HOW to render them (type-safe component map)
- Adding a new plugin widget requires: (a) plugin writes a descriptor to DB, (b) frontend adds one entry to the registry map
- No Module Federation complexity, no runtime JS injection
- Works with Next.js 16 RSC boundary: server fetches config, client renders

### For True Runtime Registration (No Build-Step Per Plugin)

If plugins cannot require frontend code changes, the SlotFill pattern (Gutenberg) or `@grlt-hub/react-slots` is appropriate. The key tradeoff: the frontend must have a generic `<PluginWidgetRenderer>` that can accept any content, and plugins inject their components into named slots at app-load time.

```typescript
// "use client" — SlotFill-style for Harness
const PluginSlotProvider = () => {
  // All plugin slot registrations happen here at startup
  // Each plugin package imports and calls slotsApi.DashboardMain.insert(...)
  return (
    <SlotFillProvider>
      {enabledPlugins.map(p => <p.SlotRegistrar key={p.name} />)}
      <Dashboard />
    </SlotFillProvider>
  );
};
```

This requires each plugin to export a `SlotRegistrar` client component that calls `Fill` on mount. The orchestrator plugin registry maps to the frontend plugin slot registrar list.

### For Server-Only Configuration (No Frontend Per-Plugin Code)

If the frontend should render widgets based ONLY on server config (no per-plugin frontend code), use the Visitor/Schema-Driven pattern with a generic widget framework like a stat card, chart wrapper, table, etc. This is limited to data visualization but requires zero per-plugin frontend code.

---

## Key Takeaways

1. **All dynamic widget registries are client-side.** This is not a limitation — it is the correct architecture boundary. Server provides data/config; client provides rendering.

2. **The type-map pattern is universal.** Every studied system (HA, Grafana, Backstage, GoodData, Dazzle) uses a string key → component lookup. The key is the stable contract between backend plugin (which declares a type) and frontend (which registers a renderer for that type).

3. **SlotFill (Gutenberg pattern) is the reference implementation for named injection points.** For systems where the frontend layout has named "holes" that plugins fill arbitrarily, SlotFill is proven at scale. `createSlotFill('name')` creates a pair; `Fill` is used by plugins, `Slot` is used by layout.

4. **Grafana's push/pull distinction matters.** "Push" (plugin decides slot) vs "Pull" (layout decides what to accept) are architecturally distinct. Harness likely wants a hybrid: dashboard defines slots, plugins declare which slots they target.

5. **Module Federation is overkill for monorepos.** Use `next/dynamic` from client components for lazy loading co-located plugin widgets.

6. **Backstage `createComponentExtension` is a useful pattern for lazy + error-isolated loading.** Each plugin widget gets its own error boundary and suspense fallback — crashing plugins don't crash the dashboard.

7. **Next.js 16 `"use cache"` directive** can cache the server-side widget layout descriptor, preventing DB queries on every dashboard visit while still allowing on-demand revalidation.

8. **React 19.2 `<Activity>`** can keep widget state alive during tab transitions without remounting — useful if dashboard has tab-based widget slots.

---

## Gaps Identified

- **UNKNOWN:** Whether the Harness plugin-contract `PluginDefinition` type should gain a `ui?: PluginUIDefinition` field to declare widget type names and slot targets. This would make the frontend registry auto-generate. Not researched — requires design decision.
- **LOW confidence:** How `react-singleton-context` would behave in the Next.js App Router with partial hydration. The library exists (https://github.com/indeedeng/react-singleton-context) but no App Router test evidence was found.
- **NOT RESEARCHED:** Priority/ordering systems for multiple plugins contributing to the same slot (Grafana `limitPerPlugin`, grlt-hub `order` property are starting points).
- **NOT RESEARCHED:** How to handle widgets that need server-side data fetching within themselves vs. receiving all data from the layout descriptor. RSC + Suspense pattern applies here.

---

## Sources

### PRIMARY (Official Documentation / Source Code)
- https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/ — HA custom card registration API
- https://deepwiki.com/home-assistant/frontend/3-lovelace-ui-framework — Lovelace card registry architecture
- https://grafana.com/developers/plugin-tools/how-to-guides/ui-extensions/ui-extensions-concepts — Grafana push/pull model
- https://grafana.com/developers/plugin-tools/how-to-guides/ui-extensions/create-an-extension-point — usePluginLinks hook and extension point creation
- https://grafana.com/developers/plugin-tools/reference/ui-extensions-reference/ui-extensions — Grafana UI Extensions API reference
- https://backstage.io/docs/frontend-system/architecture/extensions/ — Backstage extension tree system
- https://backstage.io/docs/plugins/composability/ — Backstage composability (createComponentExtension)
- https://www.gooddata.com/docs/gooddata-ui/latest/references/dashboard_component/dashboard_plugins_api/ — GoodData DashboardPlugin API
- https://developer.wordpress.org/block-editor/reference-guides/components/slot-fill/ — WordPress SlotFill API
- https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-widgets-fields/ — JSON Schema form widget registry
- https://nextjs.org/blog/next-16 — Next.js 16 release notes (Cache Components, React 19.2)
- https://nextjs.org/docs/app/getting-started/server-and-client-components — RSC constraints
- https://webpack.js.org/concepts/module-federation/ — Module Federation spec

### SECONDARY (Blog Posts, Tutorials, Community)
- https://github.com/grlt-hub/react-slots — @grlt-hub/react-slots library (Effector-backed slots)
- https://github.com/Raathigesh/dazzle — Dazzle dashboard widget registry pattern
- https://dev.to/devall/react-portalslots-2637 — react-portalslots library
- https://techhub.iodigital.com/articles/function-registry-pattern-react — Function registry pattern with predicates
- https://www.arahansen.com/react-design-patterns-generating-user-configured-ui-using-the-visitor-pattern/ — Visitor pattern for schema-driven UI
- https://nickdiego.com/a-primer-on-wordpress-slotfill-technology/ — SlotFill primer
- https://github.com/humanmade/react-slot-fill — Standalone SlotFill (Gutenberg-extracted)
- https://github.com/vercel/next.js/issues/61066 — Dynamic import from RSC bundling issue (confirmed)
- https://github.com/Raathigesh/dazzle — Dazzle dashboard open source
- https://backstage.io/docs/reference/core-plugin-api.createroutableextension/ — createRoutableExtension API
