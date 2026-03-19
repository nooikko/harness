import type { Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export class PluginsPage extends BasePage {
  gotoList = async (): Promise<void> => {
    await this.goto('/admin/plugins');
  };

  gotoSettings = async (pluginName: string): Promise<void> => {
    await this.goto(`/admin/plugins/${pluginName}`);
  };

  /** Get a row in the plugins table by plugin name. */
  getPluginRow = (name: string): Locator => this.page.getByRole('row').filter({ hasText: name });

  /** Toggle the enabled switch for a plugin row. */
  togglePlugin = async (name: string): Promise<void> => {
    const row = this.getPluginRow(name);
    await row.getByRole('switch').click();
  };
}
