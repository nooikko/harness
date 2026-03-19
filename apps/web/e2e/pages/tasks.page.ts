import type { Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class TasksPage extends BasePage {
  gotoList = async (): Promise<void> => {
    await this.goto('/tasks');
  };

  /** Get a task item by title. */
  getTask = (title: string): Locator => this.page.getByText(title);

  /** Click the new task button. */
  clickNewTask = async (): Promise<void> => {
    await this.page.getByRole('button', { name: /new task/i }).click();
  };

  /** Fill the task creation/edit form. */
  fillForm = async (fields: { title?: string; description?: string }): Promise<void> => {
    if (fields.title) {
      await this.page.getByLabel(/title/i).fill(fields.title);
    }
    if (fields.description) {
      await this.page.getByLabel(/description/i).fill(fields.description);
    }
  };

  submit = async (): Promise<void> => {
    await this.page.getByRole('button', { name: /save|create/i }).click();
  };
}
