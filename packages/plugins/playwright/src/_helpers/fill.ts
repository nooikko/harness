import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { getPage } from './browser-manager';

type Fill = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<string>;

export const fill: Fill = async (_ctx, input, meta) => {
  const selector = input.selector as string | undefined;
  const value = input.value as string | undefined;

  if (!selector || typeof selector !== 'string') {
    return 'Error: selector is required.';
  }
  if (value === undefined || typeof value !== 'string') {
    return 'Error: value is required.';
  }

  const page = await getPage(meta.threadId);

  try {
    await page.fill(selector, value, { timeout: 10_000 });
    return `Filled "${selector}" with value.`;
  } catch (err) {
    return `Error filling "${selector}": ${err instanceof Error ? err.message : String(err)}`;
  }
};
