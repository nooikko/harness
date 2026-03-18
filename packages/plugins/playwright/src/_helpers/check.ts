import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { getPage } from './browser-manager';

type Check = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<string>;

export const check: Check = async (_ctx, input, meta) => {
  const selector = input.selector as string | undefined;
  const checked = input.checked as boolean | undefined;

  if (!selector || typeof selector !== 'string') {
    return 'Error: selector is required.';
  }

  const shouldCheck = checked !== false; // default to checking

  try {
    const page = await getPage(meta.threadId);
    if (shouldCheck) {
      await page.check(selector, { timeout: 10_000 });
      return `Checked: ${selector}`;
    }
    await page.uncheck(selector, { timeout: 10_000 });
    return `Unchecked: ${selector}`;
  } catch (err) {
    return `Error toggling checkbox "${selector}": ${err instanceof Error ? err.message : String(err)}`;
  }
};
