# Research: Event-Driven Widget State Management & Priority-Based Content Display

Date: 2026-03-05

## Summary

Research into push-based widget update patterns, state management for multiplexed WebSocket subscriptions, priority scoring algorithms, Apple Smart Stack internals, notification attention management, XState actor lifecycle, and re-render prevention. Covers 7 distinct topic areas with production-proven patterns, concrete formulas, and implementation trade-offs.

---

## 1. Push-Based Widget Updates via WebSocket Multiplexing

### The Grafana Live Pattern (Production-Proven at Scale)

Grafana Live is the canonical production implementation of this exact problem: many panel (widget) subscriptions over a single WebSocket connection.

**Architecture:**
- All subscriptions on a page are multiplexed inside a single WebSocket connection per browser tab
- Channels follow the scheme `scope/namespace/path` (e.g., `plugin/music-widget/state`)
- Maximum channel length: 160 characters
- For HA setups, Redis Pub/Sub fans events across server instances

**Channel naming for plugin widgets:**
```
plugin/identity/status        → identity plugin widget
plugin/cron/next-run          → cron scheduler widget
plugin/music/playback         → YouTube music widget
ds/metrics/token-usage        → metrics data source
grafana/pipeline/step         → orchestrator pipeline events
```

The browser subscribes to relevant channels on mount and unsubscribes on unmount. The server routes incoming WebSocket messages to all channel subscribers. Each "widget" subscribes only to its own channel scope.

**Source:** https://grafana.com/docs/grafana/latest/setup-grafana/set-up-grafana-live/

### Grafana EventBus (TypeScript, Open Source)

Grafana's internal EventBus is a dual-pattern system: EventEmitter3 for legacy + RxJS Observables for modern consumers.

```typescript
// Core interface
interface EventBus {
  publish<T extends BusEvent>(event: T): void;
  subscribe<T extends BusEvent>(
    typeFilter: BusEventType<T>,
    handler: BusEventHandler<T>
  ): Unsubscribable;
  getStream<T extends BusEvent>(type: BusEventType<T>): Observable<T>;
}

// Panel plugin subscription pattern
const subscriber = eventBus
  .getStream(RefreshEvent)
  .subscribe((event) => { /* handle */ });
// Cleanup: subscriber.unsubscribe()
```

The `ScopedEventBus` class filters events by origin path, enabling per-panel event isolation within a shared bus. This is exactly the "scoped widget subscription" pattern needed.

**Source:** https://github.com/grafana/grafana/blob/master/packages/grafana-data/src/events/EventBus.ts
**Source:** https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/subscribe-events

### Adapting for the Harness Plugin System

The existing Harness `pipeline:complete` and `pipeline:step` WebSocket events already flow through `ctx.broadcast()` → web plugin's `onBroadcast` → WebSocket. The extension point is to add event namespacing:

```
// Current: flat event namespace
{ event: "pipeline:complete", data: { threadId } }

// Extended: widget-scoped events
{ event: "widget:music/playback", data: { ... } }
{ event: "widget:cron/next-run", data: { ... } }
{ event: "widget:identity/status", data: { ... } }
```

The client subscribes via a map: `Map<string, Set<(data) => void>>`. On WebSocket message, route by `event` prefix to only the relevant subscribers.

---

## 2. Event Bus / Pub-Sub Patterns in React

### Option A: Zustand with subscribeWithSelector (Recommended for Complex State)

Zustand's `subscribeWithSelector` middleware enables slice-level subscriptions that only re-render when the selected slice changes.

```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

type WidgetStore = {
  music: { track: string; playing: boolean; updatedAt: number };
  cron: { nextRun: string; lastRun: string; updatedAt: number };
  identity: { agentName: string; memoryCount: number; updatedAt: number };
};

const useWidgetStore = create<WidgetStore>()(
  subscribeWithSelector(() => ({
    music: { track: '', playing: false, updatedAt: 0 },
    cron: { nextRun: '', lastRun: '', updatedAt: 0 },
    identity: { agentName: '', memoryCount: 0, updatedAt: 0 },
  }))
);

// WebSocket initialization (outside React, at module level)
const ws = new WebSocket('ws://localhost:3001');
ws.onmessage = (msg) => {
  const { event, data } = JSON.parse(msg.data);
  if (event.startsWith('widget:')) {
    const plugin = event.slice(7); // remove "widget:"
    useWidgetStore.setState((state) => ({
      [plugin]: { ...data, updatedAt: Date.now() },
    }));
  }
};

// Component: only re-renders when music slice changes
const MusicWidget = () => {
  const music = useWidgetStore((state) => state.music);
  return <div>{music.track}</div>;
};

// Non-React subscription (for priority engine)
useWidgetStore.subscribe(
  (state) => state.music,
  (music) => { /* update priority score */ },
  { equalityFn: shallow }
);
```

**Key properties:**
- `equalityFn` defaults to `Object.is` — pass `shallow` for object slices
- `fireImmediately: true` option available for initial state
- WebSocket lives in module scope, never inside React — zero re-render cost for WS event processing

**Source:** https://github.com/pmndrs/zustand/blob/main/src/middleware/subscribeWithSelector.ts
**Source:** https://github.com/pmndrs/zustand/discussions/1651

### Option B: Jotai with atomWithObservable + RxJS (Recommended for Fine-Grained Reactivity)

Jotai's atomic model means each widget subscribes to exactly one atom. A single RxJS Subject bridges the WebSocket to per-plugin atoms via the `filter()` operator.

```typescript
import { atom } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { Subject, filter, map } from 'rxjs';

// Single WebSocket source
const wsSubject = new Subject<{ event: string; data: unknown }>();
const ws = new WebSocket('ws://localhost:3001');
ws.onmessage = (msg) => wsSubject.next(JSON.parse(msg.data));

// Per-plugin derived streams
const musicAtom = atomWithObservable(() =>
  wsSubject.pipe(
    filter(({ event }) => event === 'widget:music/playback'),
    map(({ data }) => data as MusicState),
  ),
  { initialValue: { track: '', playing: false } }
);

const cronAtom = atomWithObservable(() =>
  wsSubject.pipe(
    filter(({ event }) => event === 'widget:cron/next-run'),
    map(({ data }) => data as CronState),
  ),
  { initialValue: { nextRun: null } }
);

// Components: zero cross-widget re-renders
const MusicWidget = () => {
  const [music] = useAtom(musicAtom);
  return <div>{music.track}</div>;
};
```

**Key properties:**
- Absolute zero cross-widget re-renders — each atom is independent
- RxJS operators (debounceTime, throttleTime, distinctUntilChanged) available inline
- Suspense boundary required if `initialValue` is omitted
- Maintainer-recommended approach per Discussion #1510

**Source:** https://github.com/pmndrs/jotai/discussions/1510
**Source:** https://jotai.org/docs/utilities/async

### Option C: Custom EventTarget-Based Event Bus (Lightest Weight)

For scenarios where no state management library is needed — events that drive side effects (animations, audio) without React state:

```typescript
type WidgetEventMap = {
  'music:playback': { track: string; playing: boolean };
  'cron:fired': { jobName: string; nextRun: string };
  'pipeline:complete': { threadId: string; durationMs: number };
};

type EventBus<T extends Record<string, unknown>> = {
  on<K extends keyof T>(key: K, handler: (payload: T[K]) => void): () => void;
  emit<K extends keyof T>(key: K, payload: T[K]): void;
};

const createEventBus = <T extends Record<string, unknown>>(): EventBus<T> => {
  const handlers = new Map<keyof T, Set<(p: unknown) => void>>();
  return {
    on(key, handler) {
      if (!handlers.has(key)) handlers.set(key, new Set());
      handlers.get(key)!.add(handler as (p: unknown) => void);
      return () => handlers.get(key)?.delete(handler as (p: unknown) => void);
    },
    emit(key, payload) {
      handlers.get(key)?.forEach((h) => h(payload));
    },
  };
};

export const widgetBus = createEventBus<WidgetEventMap>();
```

This causes **zero React re-renders** — useful for driving CSS animations or audio without touching state.

**Source:** https://dawchihliou.github.io/articles/event-bus-for-react

### Comparison Table

| Approach | Re-render Isolation | Setup Complexity | Derived State | Dev Tools | Best For |
|---|---|---|---|---|---|
| Zustand + subscribeWithSelector | Per-slice | Low | Manual | Yes (Redux DevTools) | Interconnected widget state |
| Jotai + atomWithObservable + RxJS | Per-atom | Medium | Composable | Yes (Jotai DevTools) | Independent widgets with streams |
| Custom EventBus | Zero (no React) | Very Low | None | No | Side effects only (animations, audio) |
| useSyncExternalStore (raw) | Per-selector | Medium | Manual | No | Custom store with React 18 semantics |

**Source:** https://dev.to/hijazi313/state-management-in-2025-when-to-use-context-redux-zustand-or-jotai-2d2k
**Source:** https://betterstack.com/community/guides/scaling-nodejs/zustand-vs-redux-toolkit-vs-jotai/

---

## 3. Priority Queue / Relevance Scoring for Widget Display

No single published formula covers all four factors (recency + interaction + active state + pins). The following synthesizes proven algorithms from search engines, feed ranking, and Apple's WidgetKit into a composite formula.

### Component Algorithms

**A. Hacker News Time Decay (Power Law)**

```
score = (votes ^ 0.8) / ((age_hours + 2) ^ 1.8)
```

- Gravity exponent 1.8: score halves roughly every ~4 hours regardless of votes
- Self-correcting: very popular items maintain position longer
- Power law decay is smoother than exponential at the tails

**Source:** https://sangaline.com/post/reverse-engineering-the-hacker-news-ranking-algorithm/

**B. This Project's Memory Decay Formula (Already Implemented)**

```typescript
const DECAY_RATE = 0.995; // per hour
score = Math.pow(DECAY_RATE, hoursSince) + (importance / 10);
```

This is near-identical to exponential decay, equivalent to a half-life of ~138 hours (≈ 5.75 days). Well-suited for widget recency where widgets should persist for days, not minutes.

**C. Elasticsearch Gaussian Decay (Smooth Near-Origin)**

For interaction frequency scoring, Gaussian decay minimizes penalty for recent interactions while sharply penalizing stale ones:

```
score = exp(-0.5 * ((x - origin) / scale)^2)
```

Parameters: `origin` = now, `scale` = expected interaction interval, `offset` = grace period.

**Source:** https://www.elastic.co/blog/found-function-scoring

### Composite Widget Priority Formula

Combining all factors into a single `[0, 1]` score:

```typescript
type WidgetPriorityInput = {
  lastUpdatedAt: number;      // ms timestamp
  lastInteractedAt: number;   // ms timestamp
  interactionCount: number;   // total lifetime interactions
  isActive: boolean;          // e.g., music currently playing
  isPinned: boolean;
};

const DECAY_RATE = 0.995;     // per hour (matches memory plugin)
const ACTIVE_BOOST = 0.4;     // absolute boost for active state
const PIN_BOOST = 1.0;        // pins always win

const scoreWidget = (input: WidgetPriorityInput): number => {
  const now = Date.now();
  const hoursSinceUpdate = (now - input.lastUpdatedAt) / 3_600_000;
  const hoursSinceInteract = (now - input.lastInteractedAt) / 3_600_000;

  // Recency: how recently was this widget updated (new data)?
  const recencyScore = Math.pow(DECAY_RATE, hoursSinceUpdate);

  // Interaction frequency: log scale prevents power users from dominating
  const interactionScore = Math.log10(1 + input.interactionCount) / 5;

  // Interaction recency: did user recently engage with this widget?
  const interactionRecency = Math.pow(DECAY_RATE, hoursSinceInteract);

  // Weighted sum (pre-pin, pre-active)
  const baseScore =
    0.5 * recencyScore +
    0.25 * interactionScore +
    0.25 * interactionRecency;

  // Active state: currently-active widgets (music playing, task running) get boosted
  const activeScore = input.isActive ? baseScore + ACTIVE_BOOST : baseScore;

  // Pins: pinned widgets always rank above non-pinned
  return input.isPinned ? activeScore + PIN_BOOST : activeScore;
};

// Sort descending: highest priority first
widgets.sort((a, b) => scoreWidget(b) - scoreWidget(a));
```

**Weight rationale:**
- 50% recency: new data is the primary reason to surface a widget
- 25% interaction frequency: user preference signal
- 25% interaction recency: "I just used this" signal
- ACTIVE_BOOST (+0.4): hard floor above unpinned idle widgets
- PIN_BOOST (+1.0): pins are in a separate tier entirely

### Score Persistence

Store `interactionCount` and `lastInteractedAt` in `localStorage` keyed by plugin name. Reset `interactionCount` on a 30-day rolling window to prevent stale preference signals.

---

## 4. Apple Smart Stack / Dynamic Island Inspiration

### TimelineEntryRelevance (WidgetKit)

Apple's documented API for Smart Stack prioritization:

```swift
struct TimelineEntryRelevance {
  var score: Float    // arbitrary scale, relative to other entries in same timeline
  var duration: TimeInterval  // seconds this score is valid; 0 = until next entry
}
```

**Key properties:**
- Score of `0.0` means "not relevant, do not rotate to top"
- Score is relative within a single widget's timeline, not globally compared across widgets
- `duration: 0` means the score persists until the next `TimelineEntry` — use for unbounded relevance windows
- System also considers: time-of-day patterns (ML from usage), location, device state (headphones connected), foreground app

**Signals the system uses for Smart Stack ordering:**
1. `TimelineEntryRelevance.score` set by the widget developer
2. Time and date (calendar event in next hour → Calendar widget surfaces)
3. Location (reminders with location triggers)
4. Device state (AirPods connected → Podcasts/Music widget surfaces)
5. Learned user routine (ML — not directly controllable by developers)

**Source:** https://developer.apple.com/documentation/widgetkit/timelineentryrelevance
**Source:** https://developer.apple.com/documentation/widgetkit/timelineentryrelevance/init(score:duration:)
**Source:** https://developer.apple.com/videos/play/wwdc2023/10309/
**Source:** https://developer.apple.com/videos/play/wwdc2021/10049/

### Implications for Plugin Widgets

The Smart Stack model maps cleanly:
- Each plugin is a "widget" with its own timeline
- `score` corresponds to the composite formula in Section 3
- `duration` corresponds to how long the current state remains relevant (e.g., a music track playing for 3:42 → score valid for 222 seconds)
- Device state signals (music playing = headphones + audio output active) map to `isActive`

Harness plugins can provide their own relevance hints:
```typescript
// Plugin contract extension (new optional method)
type PluginWidgetRelevance = {
  score: number;         // 0-1 range
  durationMs: number;    // 0 = until next update
  reason?: string;       // debugging ("music is playing", "cron fires in 5m")
};
```

---

## 5. Notification / Attention Management Patterns

### Android Notification Ranking System

Android's `NotificationListenerService.Ranking` API exposes what the OS computes for each notification:

- `getImportance()` → 0–4 (NONE, MIN, LOW, DEFAULT, HIGH)
- `getRank()` → position in sorted notification list
- `isAmbient()` → should appear silently without heads-up
- `matchesInterruptionFilter()` → passes current DND rules
- `getLastAudiblyAlertedMs()` → timestamp of last audible alert

**Ranking inputs (from Android source):**
1. Channel importance (set by developer, overridable by user)
2. Whether notification recently alerted user with sound/vibration
3. People attached to notification (contacts boosted)
4. Active ongoing activity (media playback, navigation)
5. Android 11+ Adaptive Notification Ranking: ML model trained on dismissal patterns

**Source:** https://developer.android.com/reference/android/service/notification/NotificationListenerService.Ranking
**Source:** https://developer.android.com/develop/ui/views/notifications

### Key Attention Management Principles

From both Android and macOS notification design:

1. **Grouping**: Collapse multiple updates from the same source into one notification. For widgets: collapse rapid plugin updates before displaying.
2. **Interruption threshold**: Minor state changes (cron nextRunAt updated) should not surface the widget; major transitions (pipeline failure, music track change) should.
3. **Dismissal learning**: When a user dismisses/collapses a widget, reduce its `interactionCount` contribution for that session.
4. **Do-not-disturb windows**: Don't surface low-priority widgets during a Claude pipeline run (user is waiting for a response).
5. **Priority levels (four tiers)**:
   - URGENT: Pipeline error, agent crash → always visible, always top
   - HIGH: Active music playback, delegation in progress
   - MEDIUM: Recent cron job fired, new memory stored
   - LOW: Idle state updates, background metrics refresh

---

## 6. State Machines for Widget Lifecycle (XState v5)

### Widget State Model

XState v5 uses the actor model — each widget can be a spawned actor with its own state machine. The parent dashboard machine spawns/despawns widget actors as plugins come online.

```typescript
import { createMachine, assign, fromPromise } from 'xstate';

// Widget lifecycle machine
const widgetMachine = createMachine({
  id: 'widget',
  initial: 'hidden',
  context: {
    priority: 0,
    lastUpdated: 0,
    data: null,
  },
  states: {
    hidden: {
      on: {
        PRIORITY_THRESHOLD_MET: 'appearing',
        DATA_RECEIVED: {
          actions: assign({ data: ({ event }) => event.data }),
        },
      },
    },
    appearing: {
      // Animation: slide in, 300ms
      after: {
        300: 'visible',
      },
      on: {
        PRIORITY_DROPPED: 'hiding',
      },
    },
    visible: {
      on: {
        DATA_RECEIVED: {
          actions: assign({
            data: ({ event }) => event.data,
            lastUpdated: () => Date.now(),
          }),
        },
        DATA_STALE: 'stale',
        PRIORITY_DROPPED: 'hiding',
        USER_DISMISSED: 'hiding',
      },
    },
    stale: {
      // Show stale indicator, still visible but dimmed
      after: {
        30_000: 'hiding',  // Auto-hide after 30s if still stale
      },
      on: {
        DATA_RECEIVED: 'visible',
        PRIORITY_DROPPED: 'hiding',
      },
    },
    hiding: {
      // Animation: slide out, 200ms
      after: {
        200: 'hidden',
      },
    },
  },
});
```

**Why XState for widget lifecycle:**
- Animation triggers are state transitions, not imperative calls — easy to test
- Stale detection is a timed transition (no setInterval needed)
- Parallel widget actors operate independently, no shared state
- Invoked actors: a widget spawned while entering `visible` state auto-stops when leaving

### Parallel States for Dashboard

```typescript
const dashboardMachine = createMachine({
  id: 'dashboard',
  type: 'parallel',
  states: {
    musicWidget: { /* widgetMachine logic */ },
    cronWidget: { /* widgetMachine logic */ },
    metricsWidget: { /* widgetMachine logic */ },
    // Adding a new widget = adding a new parallel state key
  },
});
```

**Source:** https://stately.ai/docs/actors
**Source:** https://stately.ai/docs/invoke
**Source:** https://xstate.js.org/

---

## 7. Avoiding Re-render Cascades

### The Core Problem

When 10 widgets subscribe to a shared WebSocket and one event arrives, naive implementations call all 10 setState functions. React batches these in React 18, but the renders still happen if the data doesn't change.

### Solution Stack (Layered Defense)

**Layer 1: Event routing at the WebSocket layer (zero-cost)**

Route events before they reach React at all. The WebSocket handler dispatches only to relevant stores/atoms:

```typescript
const WIDGET_ROUTES: Record<string, (data: unknown) => void> = {
  'widget:music/playback': (data) => musicStore.setState(data),
  'widget:cron/next-run':  (data) => cronStore.setState(data),
  'widget:identity/status': (data) => identityStore.setState(data),
};

ws.onmessage = (msg) => {
  const { event, data } = JSON.parse(msg.data);
  WIDGET_ROUTES[event]?.(data);
  // Only the matching store's setState is called
};
```

**Layer 2: Selector equality in Zustand**

```typescript
// Without selector: re-renders on ANY store change
const store = useWidgetStore();

// With selector + shallow: only re-renders when music slice changes by reference
const music = useWidgetStore(
  (state) => state.music,
  shallow // from zustand/shallow
);
```

**Layer 3: useSyncExternalStore for custom stores**

React 18's official primitive for external store subscriptions. Guarantees consistent snapshots during concurrent rendering and prevents "tearing":

```typescript
const useMusicWidget = () => {
  return useSyncExternalStore(
    musicStore.subscribe,
    musicStore.getSnapshot,
    musicStore.getServerSnapshot, // SSR
  );
};
```

The `getSnapshot` function MUST return the same reference if data has not changed:
```typescript
// WRONG: creates new object on every call
getSnapshot: () => ({ ...currentData })

// CORRECT: returns same reference if data unchanged
let snapshot = currentData;
getSnapshot: () => {
  if (newData !== currentData) {
    currentData = newData;
    snapshot = { ...newData }; // new reference only when data changes
  }
  return snapshot;
}
```

**Source:** https://react.dev/reference/react/useSyncExternalStore

**Layer 4: requestAnimationFrame buffering for high-frequency events**

For events that arrive faster than 60fps (e.g., streaming token metrics):

```typescript
let pendingUpdate: MetricsState | null = null;
let rafId: number | null = null;

ws.onmessage = (msg) => {
  const { event, data } = JSON.parse(msg.data);
  if (event === 'widget:metrics/tokens') {
    pendingUpdate = data; // accumulate in mutable ref
    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        if (pendingUpdate) metricsStore.setState(pendingUpdate);
        pendingUpdate = null;
        rafId = null;
      });
    }
  }
};
```

This collapses N events per frame into exactly 1 render per frame, aligned to display refresh.

**Layer 5: startTransition for non-urgent widget updates**

Wrap low-priority widget state updates in `startTransition` so user interactions (typing, clicking) always preempt them:

```typescript
import { startTransition } from 'react';

ws.onmessage = (msg) => {
  const { event, data } = JSON.parse(msg.data);
  if (event === 'widget:identity/status') {
    startTransition(() => {
      identityStore.setState(data); // interruptible render
    });
  }
};
```

**Source:** https://react.dev/reference/react/startTransition

### Re-render Cost at Scale

From benchmark data (React 18, modern hardware):
- Zustand setState → render: ~12ms
- Jotai atom update → render: ~14ms
- Context update (all consumers): ~18ms + every consumer

With 10 widgets and a naive Context, a single WS event causes 10 × 18ms = 180ms of render work. With per-widget stores and routing at Layer 1, the same event causes 1 × 12ms = 12ms. This is a 15× improvement.

**Source:** https://www.reactlibraries.com/blog/zustand-vs-jotai-vs-valtio-performance-guide-2025

---

## Practical Widget Count Limits

### UX Research Consensus

- **3–5 widgets** visible at any time is the UX research sweet spot (matches Miller's Law: 7±2 items in working memory)
- Smashing Magazine (2025): "limit visible elements to about five to prevent overload"
- More than 5 simultaneously visible widgets causes scan fatigue; users stop reading them
- Progressive disclosure (expand on click) scales to any number of background widgets

**Source:** https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/
**Source:** https://uxmag.com/articles/four-cognitive-design-guidelines-for-effective-information-dashboards

### Technical Limits

For 10+ plugins each with a widget:
- **State management**: No practical limit — 100 Zustand slices or Jotai atoms is fine
- **WebSocket subscriptions**: All multiplexed over 1 connection — no per-widget overhead
- **XState actors**: 10 parallel actors is trivial; thousands are used in production (Stately)
- **Priority computation**: O(n log n) sort on every data update — negligible at n=10, fine at n=100

**Sweet spot recommendation:** Maintain 10+ widget actors (one per plugin), but display 1–3 at a time in the surface area, with a collapsed "widget tray" showing the rest. Priority score determines surface order.

---

## Architecture Recommendation for Harness

Combining all findings into a single recommended architecture:

```
WebSocket (1 connection)
    │
    ▼
Event Router (module-level, no React)
    ├── widget:music/playback  → Zustand musicSlice.setState()
    ├── widget:cron/next-run   → Zustand cronSlice.setState()
    ├── widget:identity/status → Zustand identitySlice.setState()
    └── pipeline:*             → Zustand pipelineSlice.setState()

Zustand Store (subscribeWithSelector middleware)
    │
    ├── musicSlice  ─── useWidgetStore(s => s.music, shallow)
    ├── cronSlice   ─── useWidgetStore(s => s.cron, shallow)
    └── ...         ─── useWidgetStore(s => s.identity, shallow)

Priority Engine (non-React subscriber via store.subscribe())
    │  Runs scoreWidget() on every slice update
    │  Produces sorted widget list
    ▼
Widget Tray Component (subscribes to priority order only)
    │  Re-renders only when priority ORDER changes
    │  Not when individual widget data changes
    ▼
XState Widget Actors (one per plugin)
    │  hidden → appearing → visible → stale → hiding
    │  Receive PRIORITY_THRESHOLD_MET / PRIORITY_DROPPED events
    ▼
Individual Widget Components
    Subscribe to their own store slice only
    Zero cross-widget re-renders
```

### New plugin contract extension needed

Plugins could optionally expose widget metadata:

```typescript
type PluginWidget = {
  component: React.ComponentType<{ data: unknown }>;
  getRelevance?: (data: unknown) => { score: number; durationMs: number; reason?: string };
  events: string[];  // Which WebSocket event names to subscribe to
};
```

This maps directly to the WidgetKit `TimelineEntryRelevance` model.

---

## Gaps Identified

1. **Harness-specific WebSocket event namespacing** — The current `ctx.broadcast()` system uses flat event names (`pipeline:complete`, `chat:message`). Widget-scoped events would need a naming convention (`widget:pluginName/topic`).

2. **Priority persistence** — Where to store `interactionCount` and `lastInteractedAt`: localStorage (client-only), or a new DB table for cross-device consistency.

3. **Plugin widget registration** — No current mechanism for plugins to declare a widget component. This would require a new optional `widget` field in `PluginDefinition`.

4. **Animation library** — XState state transitions drive animation triggers, but the actual CSS animation library (Framer Motion vs native CSS transitions) needs a separate decision.

5. **Smart Stack ML component** — Apple's learned routine component (the part that can't be influenced by `TimelineEntryRelevance` alone) has no published algorithm. Approximation: track time-of-day access patterns per widget in localStorage.

---

## Sources

- https://grafana.com/docs/grafana/latest/setup-grafana/set-up-grafana-live/
- https://github.com/grafana/grafana/blob/master/packages/grafana-data/src/events/EventBus.ts
- https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/subscribe-events
- https://developer.apple.com/documentation/widgetkit/timelineentryrelevance
- https://developer.apple.com/documentation/widgetkit/timelineentryrelevance/init(score:duration:)
- https://developer.apple.com/videos/play/wwdc2023/10309/
- https://developer.apple.com/videos/play/wwdc2021/10049/
- https://developer.android.com/reference/android/service/notification/NotificationListenerService.Ranking
- https://developer.android.com/develop/ui/views/notifications
- https://react.dev/reference/react/useSyncExternalStore
- https://react.dev/reference/react/startTransition
- https://zustand.docs.pmnd.rs/
- https://github.com/pmndrs/zustand/discussions/1651
- https://github.com/pmndrs/zustand/blob/main/src/middleware/subscribeWithSelector.ts
- https://jotai.org/docs/utilities/async
- https://github.com/pmndrs/jotai/discussions/1510
- https://stately.ai/docs/actors
- https://xstate.js.org/
- https://sangaline.com/post/reverse-engineering-the-hacker-news-ranking-algorithm/
- https://www.elastic.co/blog/found-function-scoring
- https://dawchihliou.github.io/articles/event-bus-for-react
- https://betterstack.com/community/guides/scaling-nodejs/zustand-vs-redux-toolkit-vs-jotai/
- https://www.reactlibraries.com/blog/zustand-vs-jotai-vs-valtio-performance-guide-2025
- https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/
- https://uxmag.com/articles/four-cognitive-design-guidelines-for-effective-information-dashboards
