---
id: plugin-settings-reload-hook
trigger: when implementing a plugin that loads and uses settings
confidence: 0.85
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin Settings Reload Hook Pattern

## Action
Always implement `onSettingsChange` hook in plugins that call `ctx.getSettings()`, storing settings in module-level variable and reloading on plugin name match.

## Evidence
- Observed 8 times in plugins: context, discord, delegation, cron, auto-namer, audit, validator, summarization
- Pattern: Load settings in register → store in module-level var → implement onSettingsChange hook → reload on matching plugin name
- Last observed: 2026-03-14 (delegation plugin, auto-namer plugin, validator plugin, etc.)

## Implementation
```
const register = async (ctx) => {
  let settings = await ctx.getSettings(settingsSchema);

  return {
    onSettingsChange: async (pluginName: string) => {
      if (pluginName !== 'plugin-name') return;
      settings = await ctx.getSettings(settingsSchema);
      ctx.logger.info('Plugin-name: settings reloaded');
    },
  };
};
```

This ensures settings changes propagate immediately without restarting the harness.
