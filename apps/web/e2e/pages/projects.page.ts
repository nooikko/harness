import { BasePage } from './base.page';

export class ProjectsPage extends BasePage {
  gotoList = async (): Promise<void> => {
    await this.goto('/chat/projects');
  };

  gotoNew = async (): Promise<void> => {
    await this.goto('/chat/projects/new');
  };

  /** Get a project card by name — clicks the card title text to navigate. */
  clickProject = async (name: string): Promise<void> => {
    await this.page.getByText(name, { exact: true }).click();
  };

  /** Navigate to a project by its description text (immune to name renames by other tests). */
  clickProjectByDescription = async (description: string): Promise<void> => {
    await this.page.getByText(description).click();
  };

  /** Fill the project creation form. */
  fillForm = async (fields: { name?: string; description?: string }): Promise<void> => {
    if (fields.name) {
      await this.page.getByLabel(/^name/i).fill(fields.name);
    }
    if (fields.description) {
      await this.page.getByLabel(/description/i).fill(fields.description);
    }
  };

  submit = async (): Promise<void> => {
    await this.page.getByRole('button', { name: /save|create/i }).click();
  };
}
