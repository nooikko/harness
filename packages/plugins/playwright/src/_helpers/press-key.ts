import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { getPage } from './browser-manager';

type PressKey = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<string>;

export const pressKey: PressKey = async (_ctx, input, meta) => {
  const key = input.key as string | undefined;
  if (!key || typeof key !== 'string') {
    return "Error: key is required (e.g., 'Enter', 'Tab', 'Escape').";
  }

  const page = await getPage(meta.threadId);

  try {
    await page.keyboard.press(key);
    return `Pressed key: ${key}`;
  } catch (err) {
    return `Error pressing key "${key}": ${err instanceof Error ? err.message : String(err)}`;
  }
};
