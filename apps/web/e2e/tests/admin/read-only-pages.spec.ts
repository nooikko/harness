import { expect, test } from '../../fixtures';

test.describe('admin read-only pages', () => {
  test('threads page renders', async ({ basePage }) => {
    await basePage.goto('/admin/threads');
    await basePage.waitForReady();

    await expect(basePage.getHeading('Threads')).toBeVisible();

    // Should have seeded threads in the table
    await expect(basePage.page.getByText('E2E General Thread')).toBeVisible();
    await expect(basePage.page.getByText('E2E Cron Thread')).toBeVisible();
  });

  test('tasks page renders', async ({ basePage }) => {
    await basePage.goto('/admin/tasks');
    await basePage.waitForReady();

    await expect(basePage.getHeading('Tasks')).toBeVisible();
    // Verify the subtitle renders
    await expect(basePage.page.getByText('Delegation tasks created by agents during sub-agent workflows.')).toBeVisible();
  });

  test('agent runs page renders', async ({ basePage }) => {
    await basePage.goto('/admin/agent-runs');
    await basePage.waitForReady();

    await expect(basePage.getHeading('Agent Runs')).toBeVisible();
    // Verify the subtitle renders
    await expect(basePage.page.getByText('Model invocations with token usage and cost tracking.')).toBeVisible();
  });

  test('usage page renders with summary cards', async ({ basePage }) => {
    await basePage.goto('/admin/usage');
    await basePage.waitForReady();

    await expect(basePage.getHeading('Token Usage')).toBeVisible();

    // Summary cards should render (even if values are zero)
    await expect(basePage.page.locator('[data-testid="card-Total Tokens"]')).toBeVisible();
    await expect(basePage.page.locator('[data-testid="card-Total Cost"]')).toBeVisible();
  });

  test('errors page renders', async ({ basePage }) => {
    await basePage.goto('/admin/errors');
    await basePage.waitForReady();

    await expect(basePage.getHeading('Errors')).toBeVisible();

    // Filter buttons should be visible
    await expect(basePage.page.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(basePage.page.getByRole('button', { name: 'Error' })).toBeVisible();
    await expect(basePage.page.getByRole('button', { name: 'Warn' })).toBeVisible();
  });

  test('integrations page renders', async ({ basePage }) => {
    await basePage.goto('/admin/integrations');
    await basePage.waitForReady();

    await expect(basePage.getHeading('Integrations')).toBeVisible();
    await expect(basePage.page.getByRole('heading', { name: 'Microsoft 365' })).toBeVisible();
    await expect(basePage.page.getByRole('button', { name: 'Connect Account' }).first()).toBeVisible();
  });
});
