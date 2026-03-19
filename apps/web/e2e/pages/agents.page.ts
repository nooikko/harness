import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';

export class AgentsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  gotoList = async (): Promise<void> => {
    await this.goto('/agents');
  };

  gotoNew = async (): Promise<void> => {
    await this.goto('/agents/new');
  };

  /** Get an agent card by name. */
  getAgentCard = (name: string): Locator => this.page.getByRole('link').filter({ hasText: name });

  /** Fill the agent creation/edit form. */
  fillForm = async (fields: { name?: string; soul?: string; identity?: string }): Promise<void> => {
    if (fields.name) {
      await this.page.getByLabel(/^name/i).fill(fields.name);
    }
    if (fields.soul) {
      await this.page.getByLabel(/soul/i).fill(fields.soul);
    }
    if (fields.identity) {
      await this.page.getByLabel(/identity/i).fill(fields.identity);
    }
  };

  submit = async (): Promise<void> => {
    await this.page.getByRole('button', { name: /save|create/i }).click();
  };
}
