import { expect, test } from '../fixtures';
import type { ThreadPage } from '../pages/thread.page';
import { TEST_PROJECT, TEST_WORKSPACE_PLAN } from '../setup/seed-data';

const gotoWorkspaceThread = async (threadPage: ThreadPage): Promise<void> => {
  await threadPage.goto('/');
  await threadPage.waitForReady();
  const sidebar = threadPage.getSidebar();
  await sidebar.getByText('E2E Workspace Thread', { exact: true }).click();
  await threadPage.waitForReady();
};

test.describe('workspace orchestration', () => {
  test.describe('project settings — working directory', () => {
    test('shows working directory field in project settings', async ({ projectsPage }) => {
      await projectsPage.gotoList();
      await projectsPage.waitForReady();
      await projectsPage.clickProjectByDescription(TEST_PROJECT.description);
      await projectsPage.waitForReady();

      await projectsPage.page.getByRole('link', { name: /settings/i }).click();
      await projectsPage.waitForReady();

      // Working directory field should be visible
      await expect(projectsPage.page.locator('#proj-working-dir')).toBeVisible();
      await expect(projectsPage.page.getByText('Working Directory')).toBeVisible();
    });

    test('working directory shows seeded value', async ({ projectsPage }) => {
      await projectsPage.gotoList();
      await projectsPage.waitForReady();
      await projectsPage.clickProjectByDescription(TEST_PROJECT.description);
      await projectsPage.waitForReady();

      await projectsPage.page.getByRole('link', { name: /settings/i }).click();
      await projectsPage.waitForReady();

      await expect(projectsPage.page.locator('#proj-working-dir')).toHaveValue('/tmp/e2e-test-project');
    });

    test('can update working directory path', async ({ projectsPage }) => {
      await projectsPage.gotoList();
      await projectsPage.waitForReady();
      await projectsPage.clickProjectByDescription(TEST_PROJECT.description);
      await projectsPage.waitForReady();

      await projectsPage.page.getByRole('link', { name: /settings/i }).click();
      await projectsPage.waitForReady();

      // Clear and type a new path
      await projectsPage.page.locator('#proj-working-dir').clear();
      await projectsPage.page.locator('#proj-working-dir').fill('/tmp/new-project-path');

      await projectsPage.page.getByRole('button', { name: 'Save Changes' }).click();
      await projectsPage.waitForReady();

      // Navigate back to settings and verify persistence
      await projectsPage.page.getByRole('link', { name: /settings/i }).click();
      await projectsPage.waitForReady();

      await expect(projectsPage.page.locator('#proj-working-dir')).toHaveValue('/tmp/new-project-path');
    });

    test('clear button removes working directory', async ({ projectsPage }) => {
      await projectsPage.gotoList();
      await projectsPage.waitForReady();
      await projectsPage.clickProjectByDescription(TEST_PROJECT.description);
      await projectsPage.waitForReady();

      await projectsPage.page.getByRole('link', { name: /settings/i }).click();
      await projectsPage.waitForReady();

      // Click the clear button (X icon)
      await projectsPage.page.getByRole('button', { name: /clear working directory/i }).click();

      // Input should be empty
      await expect(projectsPage.page.locator('#proj-working-dir')).toHaveValue('');
    });
  });

  test.describe
    .serial('thread — workspace controls', () => {
      test('workspace status badge is visible for thread with active plan', async ({ threadPage }) => {
        await gotoWorkspaceThread(threadPage);

        // The workspace controls badge should be visible (shows "1/3" since 1 of 3 tasks accepted)
        await expect(threadPage.page.getByText('1/3')).toBeVisible();
      });

      test('clicking workspace badge opens plan overview dialog', async ({ threadPage }) => {
        await gotoWorkspaceThread(threadPage);

        // Click the workspace badge
        await threadPage.page.getByText('1/3').click();

        // Dialog should open with plan details
        await expect(threadPage.page.getByText('Workspace Plan')).toBeVisible();
        await expect(threadPage.page.getByText(TEST_WORKSPACE_PLAN.objective)).toBeVisible();
      });

      test('plan overview shows all tasks with statuses', async ({ threadPage }) => {
        await gotoWorkspaceThread(threadPage);
        await threadPage.page.getByText('1/3').click();

        // Check each task is listed
        await expect(threadPage.page.getByText('t1: Unit tests for delegation helpers')).toBeVisible();
        await expect(threadPage.page.getByText('t2: Integration tests for pipeline')).toBeVisible();
        await expect(threadPage.page.getByText('t3: E2E test plan')).toBeVisible();

        // Check status badges (use exact + first to avoid matching "1/3 tasks accepted")
        await expect(threadPage.page.getByText('accepted', { exact: true }).first()).toBeVisible();
        await expect(threadPage.page.getByText('delegated', { exact: true }).first()).toBeVisible();
        await expect(threadPage.page.getByText('pending', { exact: true }).first()).toBeVisible();
      });

      test('plan overview shows progress indicator', async ({ threadPage }) => {
        await gotoWorkspaceThread(threadPage);
        await threadPage.page.getByText('1/3').click();

        // Should show 1/3 tasks accepted
        await expect(threadPage.page.getByText('1/3 tasks accepted')).toBeVisible();
      });

      test('pause button changes plan status', async ({ threadPage }) => {
        await gotoWorkspaceThread(threadPage);
        await threadPage.page.getByText('1/3').click();

        // Click pause
        await threadPage.page.getByRole('button', { name: /pause/i }).click();

        // Status should update to paused
        await expect(threadPage.page.getByText('paused')).toBeVisible();
      });

      test('stop button removes workspace badge after refresh', async ({ threadPage }) => {
        await gotoWorkspaceThread(threadPage);
        await threadPage.page.getByText('1/3').first().click();

        // Click stop
        await threadPage.page.getByRole('button', { name: /stop/i }).click();

        // Wait for refresh — the workspace badge should disappear since status is now failed
        await threadPage.waitForReady();

        // The workspace controls badge should no longer be in the header
        // (WorkspaceControls only renders for planning/active/paused statuses)
        await expect(threadPage.page.getByText('Workspace Plan')).not.toBeVisible();
      });
    });

  test.describe('thread — workspace badge not visible for non-workspace threads', () => {
    test('general thread without plan shows no workspace badge', async ({ threadPage }) => {
      await threadPage.goto('/');
      await threadPage.waitForReady();
      const sidebar = threadPage.getSidebar();
      await sidebar.getByText('E2E General Thread', { exact: true }).click();
      await threadPage.waitForReady();

      // No workspace controls should be visible — the Target icon / badge shouldn't appear
      await expect(threadPage.page.getByText('Workspace Plan')).not.toBeVisible();
    });
  });
});
