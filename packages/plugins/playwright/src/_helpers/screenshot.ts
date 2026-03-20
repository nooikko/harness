import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { getPage } from './browser-manager';

type Screenshot = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<string>;

export const screenshot: Screenshot = async (ctx, input, meta) => {
  const fullPage = (input.full_page as boolean) ?? false;

  try {
    const page = await getPage(meta.threadId);

    const buffer = await page.screenshot({
      fullPage,
      timeout: 15_000,
    });

    const filename = `screenshot-${Date.now()}.png`;
    const { fileId } = await ctx.uploadFile({
      filename,
      buffer: Buffer.from(buffer),
      mimeType: 'image/png',
      scope: 'THREAD',
      threadId: meta.threadId,
    });

    return [
      `Screenshot saved: ${filename} (file ID: ${fileId})`,
      `Page: ${page.url()}`,
      '',
      'The screenshot has been persisted as a file attachment on this thread and will be visible in the chat UI.',
    ].join('\n');
  } catch (err) {
    return `Error taking screenshot: ${err instanceof Error ? err.message : String(err)}`;
  }
};
