import { expect, test } from '../../fixtures';

test.describe('plugins admin', () => {
  test('list page renders with plugin rows', async ({ pluginsPage }) => {
    await pluginsPage.gotoList();
    await pluginsPage.waitForReady();

    await expect(pluginsPage.getHeading('Plugins')).toBeVisible();

    // Should have at least a few plugin rows (from seed data and orchestrator defaults)
    const rows = pluginsPage.page.getByRole('row');
    // Header row + at least 1 data row
    await expect(rows).not.toHaveCount(1);
  });

  test('plugin rows have toggle switches', async ({ pluginsPage }) => {
    await pluginsPage.gotoList();
    await pluginsPage.waitForReady();

    // At least one switch should be visible in the table
    const switches = pluginsPage.page.getByRole('switch');
    const count = await switches.count();
    expect(count).toBeGreaterThan(0);
  });

  test('toggle plugin enabled/disabled', async ({ pluginsPage }) => {
    await pluginsPage.gotoList();
    await pluginsPage.waitForReady();

    // Find the discord row (seeded as disabled)
    const discordRow = pluginsPage.getPluginRow('discord');
    const toggle = discordRow.getByRole('switch');

    // Should be unchecked (disabled)
    await expect(toggle).not.toBeChecked();

    // Enable it
    await toggle.click();
    await expect(toggle).toBeChecked();

    // Disable it again
    await toggle.click();
    await expect(toggle).not.toBeChecked();
  });
});
