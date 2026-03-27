import { createSettingsSchema, type SettingsFieldDefs } from '@harness/plugin-contract';

export const settingsFields = {
  defaultTimeout: {
    type: 'number' as const,
    label: 'Default Timeout (seconds)',
    default: 30,
  },
  maxOutputLength: {
    type: 'number' as const,
    label: 'Max Output Length (bytes)',
    default: 50000,
  },
  logCommands: {
    type: 'boolean' as const,
    label: 'Log Commands',
    default: true,
  },
  maxConcurrentPerHost: {
    type: 'number' as const,
    label: 'Max Concurrent Commands Per Host',
    description: 'Maximum simultaneous SSH commands per host. Excess commands are queued.',
    default: 10,
  },
  maxPoolConnections: {
    type: 'number' as const,
    label: 'Max Pool Connections',
    description: 'Maximum total SSH connections across all hosts.',
    default: 20,
  },
} satisfies SettingsFieldDefs;

export const settingsSchema = createSettingsSchema(settingsFields);
