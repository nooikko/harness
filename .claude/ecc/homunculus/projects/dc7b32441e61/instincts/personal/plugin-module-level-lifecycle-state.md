---
id: plugin-module-level-lifecycle-state
trigger: when a plugin needs to maintain state across multiple hooks and lifecycle methods
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin Module-Level Lifecycle State Pattern

## Action
Use module-level typed state object to hold persistent plugin resources (connections, servers, handlers) across register → start → stop lifecycle and between hook invocations.

## Evidence
- Observed 4+ times in plugins: discord, web, cron, delegation
- Pattern: Define typed state interface → initialize empty state at module level → populate in register/start → clean in stop → reference in hooks
- Last observed: 2026-03-14 (discord: resolvedToken + state, web: server + broadcaster, cron: stopServer, delegation: setHooks + currentHooks)

## Implementation
```typescript
type PluginState = {
  client: SomeClient | null;
  isConnected: boolean;
};

const state: PluginState = {
  client: null,
  isConnected: false,
};

export const plugin: PluginDefinition = {
  register: async (ctx) => {
    // Populate state during setup
    return {
      onSomeHook: async () => {
        if (!state.client) throw new Error('Plugin not started');
        // Use state
      },
    };
  },

  start: async (ctx) => {
    state.client = await initClient();
    state.isConnected = true;
  },

  stop: async (ctx) => {
    if (state.client) {
      await state.client.destroy();
      state.client = null;
      state.isConnected = false;
    }
  },
};
```

This avoids closure issues with async initialization and allows plugins to be restarted cleanly.
