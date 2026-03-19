import type { Page } from '@playwright/test';

/**
 * Base page object with shared helpers for all E2E page objects.
 */
export class BasePage {
  constructor(readonly page: Page) {}

  goto = async (path: string): Promise<void> => {
    await this.page.goto(path);
  };

  /** Wait for the page to be hydrated (no loading spinners visible). */
  waitForReady = async (): Promise<void> => {
    await this.page.waitForLoadState('networkidle');
  };

  /** Get the sidebar navigation element. */
  getSidebar = () => this.page.getByRole('complementary');

  /** Get the top bar navigation element. */
  getTopBar = () => this.page.locator('header').first();

  /** Navigate via sidebar link text. */
  clickSidebarLink = async (name: string): Promise<void> => {
    await this.getSidebar().getByRole('link', { name }).click();
  };

  /** Get page heading (first h1 or h2). */
  getHeading = (text: string) => this.page.getByRole('heading', { name: text });

  /** Wait for a toast notification with the given text. */
  waitForToast = async (text: string): Promise<void> => {
    await this.page.getByText(text).waitFor({ state: 'visible' });
  };
}
