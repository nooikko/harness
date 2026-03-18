import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { getPage } from './browser-manager';

type SelectOption = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<string>;

export const selectOption: SelectOption = async (_ctx, input, meta) => {
  const selector = input.selector as string | undefined;
  const value = input.value as string | undefined;

  if (!selector || typeof selector !== 'string') {
    return 'Error: selector is required.';
  }
  if (value === undefined || typeof value !== 'string') {
    return 'Error: value is required.';
  }

  try {
    const page = await getPage(meta.threadId);
    const selected = await page.selectOption(selector, value, { timeout: 10_000 });
    return `Selected option "${selected.join(', ')}" in "${selector}".`;
  } catch (err) {
    return `Error selecting option in "${selector}": ${err instanceof Error ? err.message : String(err)}`;
  }
};
