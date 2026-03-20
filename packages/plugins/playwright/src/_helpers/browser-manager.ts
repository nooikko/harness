import type { Browser, BrowserContext, Page } from 'playwright';

const PAGE_TTL_MS = 10 * 60 * 1000; // 10 minutes (2x default Claude timeout)

type PageEntry = {
  page: Page;
  context: BrowserContext;
  lastUsed: number;
  recording?: boolean;
};

let browser: Browser | null = null;
const pages = new Map<string, PageEntry>();
let sweepInterval: ReturnType<typeof setInterval> | null = null;

type LaunchBrowser = () => Promise<void>;

export const launchBrowser: LaunchBrowser = async () => {
  if (browser) {
    return;
  }
  // Dynamic import to avoid loading playwright at module parse time
  const { chromium } = await import('playwright');
  browser = await chromium.launch({ headless: true });
  sweepInterval = setInterval(sweepStalePages, 60_000);
};

type CloseBrowser = () => Promise<void>;

export const closeBrowser: CloseBrowser = async () => {
  const b = browser;
  browser = null; // Signal to getPage() immediately
  if (sweepInterval) {
    clearInterval(sweepInterval);
    sweepInterval = null;
  }
  for (const [threadId, entry] of pages) {
    await entry.context.close().catch(() => {});
    pages.delete(threadId);
  }
  if (b) {
    await b.close().catch(() => {});
  }
};

type GetPage = (threadId: string) => Promise<Page>;

export const getPage: GetPage = async (threadId) => {
  const existing = pages.get(threadId);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing.page;
  }

  if (!browser) {
    throw new Error('Browser not launched. Call launchBrowser() first.');
  }

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  pages.set(threadId, { page, context, lastUsed: Date.now() });
  return page;
};

type RecordingOptions = {
  videoDir: string;
  width?: number;
  height?: number;
};

type GetPageWithRecording = (threadId: string, options: RecordingOptions) => Promise<Page>;

/** Creates a new browser context with video recording enabled.
 *  Closes any existing context for this thread first.
 *  The recording is finalized when the context is closed (via closePageForThread). */
export const getPageWithRecording: GetPageWithRecording = async (threadId, options) => {
  // Close existing context if any
  await closePageForThread(threadId);

  if (!browser) {
    throw new Error('Browser not launched. Call launchBrowser() first.');
  }

  const { mkdir } = await import('node:fs/promises');
  await mkdir(options.videoDir, { recursive: true });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    recordVideo: {
      dir: options.videoDir,
      size: { width: options.width ?? 1280, height: options.height ?? 720 },
    },
  });
  const page = await context.newPage();
  pages.set(threadId, { page, context, lastUsed: Date.now(), recording: true });
  return page;
};

type ClosePageForThread = (threadId: string) => Promise<void>;

export const closePageForThread: ClosePageForThread = async (threadId) => {
  const entry = pages.get(threadId);
  if (entry) {
    await entry.context.close().catch(() => {});
    pages.delete(threadId);
  }
};

type IsRecordingActive = (threadId: string) => boolean;

export const isRecordingActive: IsRecordingActive = (threadId) => {
  const entry = pages.get(threadId);
  return entry?.recording === true;
};

type SweepStalePages = () => void;

const sweepStalePages: SweepStalePages = () => {
  const now = Date.now();
  for (const [threadId, entry] of pages) {
    if (now - entry.lastUsed > PAGE_TTL_MS) {
      entry.context.close().catch(() => {});
      pages.delete(threadId);
    }
  }
};

type IsBrowserRunning = () => boolean;

export const isBrowserRunning: IsBrowserRunning = () => browser !== null;

type GetActivePageCount = () => number;

export const getActivePageCount: GetActivePageCount = () => pages.size;
