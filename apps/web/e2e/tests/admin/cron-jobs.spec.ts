import { expect, test } from '../../fixtures';
import { TEST_CRON_JOBS } from '../../setup/seed-data';

test.describe('cron jobs admin', () => {
  test('list page renders with seeded jobs', async ({ cronJobsPage }) => {
    await cronJobsPage.gotoList();
    await cronJobsPage.waitForReady();

    await expect(cronJobsPage.getHeading('Scheduled Tasks')).toBeVisible();

    // Verify seeded jobs appear
    await expect(cronJobsPage.getJobRow(TEST_CRON_JOBS.recurring.name)).toBeVisible();
    await expect(cronJobsPage.getJobRow(TEST_CRON_JOBS.oneShot.name)).toBeVisible();
    await expect(cronJobsPage.getJobRow(TEST_CRON_JOBS.disabled.name)).toBeVisible();
  });

  test('new task button navigates to create form', async ({ cronJobsPage }) => {
    await cronJobsPage.gotoList();
    await cronJobsPage.waitForReady();

    await cronJobsPage.newTaskButton.click();
    await expect(cronJobsPage.page).toHaveURL(/\/admin\/cron-jobs\/new/);
    await expect(cronJobsPage.getHeading('New Scheduled Task')).toBeVisible();
  });

  test('create form renders with all fields', async ({ cronJobsPage }) => {
    await cronJobsPage.gotoNew();
    await cronJobsPage.waitForReady();

    // Check all form fields exist
    await expect(cronJobsPage.page.locator('#cron-job-name')).toBeVisible();
    await expect(cronJobsPage.page.locator('#cron-job-agent')).toBeVisible();
    await expect(cronJobsPage.page.locator('#cron-job-prompt')).toBeVisible();
    await expect(cronJobsPage.page.locator('#cron-job-schedule')).toBeVisible();

    // Check buttons
    await expect(cronJobsPage.page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(cronJobsPage.page.getByRole('button', { name: 'Create Job' })).toBeVisible();
  });

  test('create form type toggle switches between recurring and one-shot', async ({ cronJobsPage }) => {
    await cronJobsPage.gotoNew();
    await cronJobsPage.waitForReady();

    // Default is recurring — schedule field visible
    await expect(cronJobsPage.page.locator('#cron-job-schedule')).toBeVisible();

    // Switch to one-shot
    await cronJobsPage.page.getByRole('button', { name: 'One-shot' }).click();
    await expect(cronJobsPage.page.locator('#cron-job-fire-at')).toBeVisible();
    await expect(cronJobsPage.page.locator('#cron-job-schedule')).not.toBeVisible();

    // Switch back to recurring
    await cronJobsPage.page.getByRole('button', { name: 'Recurring' }).click();
    await expect(cronJobsPage.page.locator('#cron-job-schedule')).toBeVisible();
  });

  test('toggle job enabled/disabled', async ({ cronJobsPage }) => {
    await cronJobsPage.gotoList();
    await cronJobsPage.waitForReady();

    const row = cronJobsPage.getJobRow(TEST_CRON_JOBS.recurring.name);
    const toggle = row.getByRole('switch');

    // Currently enabled — toggle off
    await expect(toggle).toBeChecked();
    await toggle.click();

    // Wait for state to update
    await expect(toggle).not.toBeChecked();

    // Toggle back on
    await toggle.click();
    await expect(toggle).toBeChecked();
  });
});
