import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { getPage } from './browser-manager';

type Click = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<string>;

export const click: Click = async (_ctx, input, meta) => {
  const selector = input.selector as string | undefined;
  if (!selector || typeof selector !== 'string') {
    return 'Error: selector is required.';
  }

  const page = await getPage(meta.threadId);

  try {
    await page.click(selector, { timeout: 10_000 });
    // Wait briefly for any navigation or DOM updates
    await page.waitForTimeout(500);
    return `Clicked: ${selector}`;
  } catch (err) {
    return `Error clicking "${selector}": ${err instanceof Error ? err.message : String(err)}`;
  }
};
