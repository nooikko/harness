import { expect, test } from '../fixtures';
import { TEST_AGENT, TEST_THREADS } from '../setup/seed-data';

test.describe('chat input settings popover', () => {
  test.beforeEach(async ({ threadPage }) => {
    await threadPage.goto('/');
    await threadPage.waitForReady();

    // Navigate to the seeded general thread
    const sidebar = threadPage.getSidebar();
    await sidebar.getByText(TEST_THREADS.general.name, { exact: true }).click();
    await threadPage.waitForReady();
  });

  test('settings gear icon is visible next to send button', async ({ threadPage }) => {
    await expect(threadPage.getSettingsButton()).toBeVisible();
    await expect(threadPage.getSendButton()).toBeVisible();
  });

  test('model selector remains visible in main controls bar', async ({ threadPage }) => {
    await expect(threadPage.getModelSelector()).toBeVisible();
  });

  test('popover opens with Agent, Thinking, and Permissions rows', async ({ threadPage }) => {
    await threadPage.openSettingsPopover();

    const popover = threadPage.page.locator('[data-radix-popper-content-wrapper]');
    await expect(popover.getByText('Agent', { exact: true })).toBeVisible();
    await expect(popover.getByText('Thinking', { exact: true })).toBeVisible();
    await expect(popover.getByText('Permissions', { exact: true })).toBeVisible();
  });

  test('agent selector shows the assigned agent', async ({ threadPage }) => {
    await threadPage.openSettingsPopover();

    const popover = threadPage.page.locator('[data-radix-popper-content-wrapper]');
    await expect(popover.getByText(TEST_AGENT.name)).toBeVisible();
  });

  test('thinking effort defaults to Default', async ({ threadPage }) => {
    await threadPage.openSettingsPopover();

    // The popover should show "Thinking" label and its value "Default"
    const popover = threadPage.page.locator('[data-radix-popper-content-wrapper]');
    await expect(popover.getByText('Thinking', { exact: true })).toBeVisible();
    // The whole popover content should contain "Default" near "Thinking"
    await expect(popover).toContainText('Default');
  });

  test('permissions defaults to Bypass', async ({ threadPage }) => {
    await threadPage.openSettingsPopover();

    const popover = threadPage.page.locator('[data-radix-popper-content-wrapper]');
    await expect(popover.getByText('Permissions', { exact: true })).toBeVisible();
    await expect(popover.locator('button', { hasText: 'Bypass' })).toBeVisible();
  });
});
