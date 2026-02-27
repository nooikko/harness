import { encryptValue } from '@harness/plugin-contract';
import type { PluginSettingsField } from '@/generated/plugin-settings-registry';

export type BuildSettingsPayload = (fields: PluginSettingsField[], formData: Record<string, string>, encryptionKey: string) => Record<string, string>;

export const buildSettingsPayload: BuildSettingsPayload = (fields, formData, encryptionKey) => {
  const payload: Record<string, string> = {};
  for (const field of fields) {
    const value = formData[field.name];
    if (value === undefined) {
      continue;
    }
    // Empty secret = user did not retype — skip so existing encrypted value is preserved via merge
    if (field.secret && !value) {
      continue;
    }
    if (field.secret && encryptionKey && value) {
      payload[field.name] = encryptValue(value, encryptionKey);
    } else {
      payload[field.name] = value;
    }
  }
  return payload;
};
