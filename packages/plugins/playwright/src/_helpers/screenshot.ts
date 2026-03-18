import { join } from 'node:path';
import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { getPage } from './browser-manager';
import { ensureTraceDir, trackFile } from './temp-tracker';

type Screenshot = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<string>;

export const screenshot: Screenshot = async (_ctx, input, meta) => {
  const fullPage = (input.full_page as boolean) ?? false;

  try {
    const page = await getPage(meta.threadId);
    const traceId = meta.traceId ?? 'unknown';
    const dir = ensureTraceDir(traceId);
    const filename = `screenshot-${Date.now()}.png`;
    const filePath = join(dir, filename);

    await page.screenshot({
      path: filePath,
      fullPage,
      timeout: 15_000,
    });

    trackFile(traceId, filePath);

    return [
      `Screenshot saved: ${filePath}`,
      `Page: ${page.url()}`,
      '',
      'Note: This file is temporary and will be auto-deleted when this pipeline run completes.',
      'If the user explicitly requested this screenshot, include the file path in your response so they can retrieve it before cleanup.',
    ].join('\n');
  } catch (err) {
    return `Error taking screenshot: ${err instanceof Error ? err.message : String(err)}`;
  }
};
