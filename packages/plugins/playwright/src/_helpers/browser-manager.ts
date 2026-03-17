import type { Browser, BrowserContext, Page } from 'playwright';

const PAGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type PageEntry = {
  page: Page;
  context: BrowserContext;
  lastUsed: number;
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
  if (sweepInterval) {
    clearInterval(sweepInterval);
    sweepInterval = null;
  }
  for (const [threadId, entry] of pages) {
    await entry.context.close().catch(() => {});
    pages.delete(threadId);
  }
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
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

type ClosePageForThread = (threadId: string) => Promise<void>;

export const closePageForThread: ClosePageForThread = async (threadId) => {
  const entry = pages.get(threadId);
  if (entry) {
    await entry.context.close().catch(() => {});
    pages.delete(threadId);
  }
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
