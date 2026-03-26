import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { getPage } from './browser-manager';
import { validateUrl } from './validate-url';

type ValidatePages = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<string>;

export const validatePages: ValidatePages = async (ctx, input, meta) => {
  const urls = input.urls as string[] | undefined;
  if (!urls || urls.length === 0) {
    return 'Error: urls array is required and must not be empty.';
  }

  if (urls.length > 20) {
    return 'Error: Maximum 20 URLs per validation run.';
  }

  const results: Array<{ url: string; fileId?: string; error?: string }> = [];

  try {
    const page = await getPage(meta.threadId);

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]!;
      meta.reportProgress?.(`Screenshotting page ${i + 1}/${urls.length}`, { current: i + 1, total: urls.length });

      const validation = validateUrl(url);
      if (!validation.valid) {
        results.push({ url, error: `Blocked: ${validation.reason}` });
        continue;
      }

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });

        const buffer = await page.screenshot({ fullPage: false, timeout: 15_000 });
        const filename = `validate-${new URL(url).pathname.replace(/\//g, '-').replace(/^-|-$/g, '') || 'index'}-${Date.now()}.png`;
        const { fileId } = await ctx.uploadFile({
          filename,
          buffer: Buffer.from(buffer),
          mimeType: 'image/png',
          scope: 'THREAD',
          threadId: meta.threadId,
        });

        results.push({ url, fileId });
      } catch (err) {
        results.push({ url, error: err instanceof Error ? err.message : String(err) });
      }
    }
  } catch (err) {
    return `Error initializing browser: ${err instanceof Error ? err.message : String(err)}`;
  }

  const succeeded = results.filter((r) => r.fileId);
  const failed = results.filter((r) => r.error);

  const lines = [
    `Validation complete: ${succeeded.length}/${results.length} pages captured.`,
    '',
    ...succeeded.map((r) => `✓ ${r.url} → file ID: ${r.fileId}`),
    ...failed.map((r) => `✗ ${r.url} → ${r.error}`),
    '',
    'All screenshots have been persisted as file attachments and will be visible inline in the chat UI.',
  ];

  return lines.join('\n');
};
