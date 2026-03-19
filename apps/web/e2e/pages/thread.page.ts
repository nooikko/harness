import type { Page } from '@playwright/test';
import { BasePage } from './base.page';

export class ThreadPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  gotoThread = async (threadId: string): Promise<void> => {
    await this.goto(`/chat/${threadId}`);
  };

  gotoNewChat = async (): Promise<void> => {
    await this.goto('/chat/new');
  };

  /** Get the thread header (contains name, actions). */
  getHeader = () => this.page.locator("[data-testid='thread-header']");

  /** Open the manage thread modal. */
  openManageModal = async (): Promise<void> => {
    await this.page.getByRole('button', { name: /manage|settings/i }).click();
  };
}
