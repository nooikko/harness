import { expect, test } from '../../fixtures';

test.describe('admin navigation', () => {
  test('/admin redirects to /admin/cron-jobs', async ({ basePage }) => {
    await basePage.goto('/admin');
    await basePage.waitForReady();
    await expect(basePage.page).toHaveURL(/\/admin\/cron-jobs/);
  });

  test('admin sidebar contains all navigation links', async ({ basePage }) => {
    await basePage.goto('/admin/cron-jobs');
    await basePage.waitForReady();

    const sidebar = basePage.getSidebar();

    // Account group
    await expect(sidebar.getByRole('link', { name: 'Profile' })).toBeVisible();

    // Configuration group
    await expect(sidebar.getByRole('link', { name: 'Plugins' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Cron Jobs' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Integrations' })).toBeVisible();

    // Activity group
    await expect(sidebar.getByRole('link', { name: 'Agent Runs' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Errors' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Tasks' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Threads' })).toBeVisible();

    // Analytics group
    await expect(sidebar.getByRole('link', { name: 'Usage' })).toBeVisible();
  });

  test('sidebar links navigate to correct pages', async ({ basePage }) => {
    await basePage.goto('/admin/cron-jobs');
    await basePage.waitForReady();

    const sidebar = basePage.getSidebar();

    await sidebar.getByRole('link', { name: 'Plugins' }).click();
    await expect(basePage.page).toHaveURL(/\/admin\/plugins/);
    await expect(basePage.getHeading('Plugins')).toBeVisible();

    await sidebar.getByRole('link', { name: 'Profile' }).click();
    await expect(basePage.page).toHaveURL(/\/admin\/profile/);
    await expect(basePage.getHeading('Profile')).toBeVisible();

    await sidebar.getByRole('link', { name: 'Threads' }).click();
    await expect(basePage.page).toHaveURL(/\/admin\/threads/);
    await expect(basePage.getHeading('Threads')).toBeVisible();

    await sidebar.getByRole('link', { name: 'Usage' }).click();
    await expect(basePage.page).toHaveURL(/\/admin\/usage/);
    await expect(basePage.getHeading('Token Usage')).toBeVisible();
  });
});
