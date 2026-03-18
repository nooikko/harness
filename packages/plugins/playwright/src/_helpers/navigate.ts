import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { getPage } from './browser-manager';
import { validateUrl } from './validate-url';

type Navigate = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<string>;

export const navigate: Navigate = async (_ctx, input, meta) => {
  const url = input.url as string | undefined;
  if (!url || typeof url !== 'string') {
    return 'Error: url is required.';
  }

  const validation = validateUrl(url);
  if (!validation.valid) {
    return `Error: ${validation.reason}`;
  }

  try {
    const page = await getPage(meta.threadId);
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const title = await page.title();
    const finalUrl = page.url();
    const status = response?.status() ?? 'unknown';

    return `Navigated to: ${finalUrl}\nTitle: ${title}\nStatus: ${status}`;
  } catch (err) {
    return `Error navigating to ${url}: ${err instanceof Error ? err.message : String(err)}`;
  }
};
