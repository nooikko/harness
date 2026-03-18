import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { getPage } from './browser-manager';

type Snapshot = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<string>;

export const snapshot: Snapshot = async (_ctx, _input, meta) => {
  try {
    const page = await getPage(meta.threadId);
    const tree = await page.locator(':root').ariaSnapshot();
    if (!tree || tree.trim().length === 0) {
      return '(empty accessibility tree — page may not have loaded)';
    }
    return tree;
  } catch (err) {
    return `Error taking snapshot: ${err instanceof Error ? err.message : String(err)}`;
  }
};
