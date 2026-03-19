import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../base.page';

export class CronJobsPage extends BasePage {
  readonly newTaskButton: Locator;

  constructor(page: Page) {
    super(page);
    this.newTaskButton = page.getByRole('link', { name: /new task/i });
  }

  gotoList = async (): Promise<void> => {
    await this.goto('/admin/cron-jobs');
  };

  gotoNew = async (): Promise<void> => {
    await this.goto('/admin/cron-jobs/new');
  };

  /** Get a row in the cron jobs table by job name. */
  getJobRow = (name: string): Locator => this.page.getByRole('row').filter({ hasText: name });

  /** Toggle the enabled switch for a job row. */
  toggleJob = async (name: string): Promise<void> => {
    const row = this.getJobRow(name);
    await row.getByRole('switch').click();
  };

  /** Click the delete button for a job row. */
  deleteJob = async (name: string): Promise<void> => {
    const row = this.getJobRow(name);
    await row.getByRole('button', { name: /delete/i }).click();
  };

  /** Fill the cron job form fields. */
  fillForm = async (fields: { name?: string; prompt?: string; schedule?: string }): Promise<void> => {
    if (fields.name) {
      await this.page.getByLabel(/name/i).fill(fields.name);
    }
    if (fields.prompt) {
      await this.page.getByLabel(/prompt/i).fill(fields.prompt);
    }
    if (fields.schedule) {
      await this.page.getByLabel(/schedule/i).fill(fields.schedule);
    }
  };

  /** Submit the cron job form. */
  submit = async (): Promise<void> => {
    await this.page.getByRole('button', { name: /save|create/i }).click();
  };
}
