import type { Page } from '@playwright/test';
import { BasePage } from '../base.page';

export class ProfilePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  gotoProfile = async (): Promise<void> => {
    await this.goto('/admin/profile');
  };

  fillForm = async (fields: { name?: string; pronouns?: string; location?: string }): Promise<void> => {
    if (fields.name) {
      await this.page.getByLabel(/^name/i).fill(fields.name);
    }
    if (fields.pronouns) {
      await this.page.getByLabel(/pronouns/i).fill(fields.pronouns);
    }
    if (fields.location) {
      await this.page.getByLabel(/location/i).fill(fields.location);
    }
  };

  submit = async (): Promise<void> => {
    await this.page.getByRole('button', { name: /save/i }).click();
  };
}
