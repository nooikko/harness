import { expect, test } from '../fixtures';

test.describe('smoke tests', () => {
  test('homepage redirects to a chat thread', async ({ basePage }) => {
    await basePage.goto('/');
    await basePage.waitForReady();

    // The root page should redirect to /chat/:id
    await expect(basePage.page).toHaveURL(/\/chat\/.+/);
  });

  test('sidebar renders with navigation links', async ({ basePage }) => {
    await basePage.goto('/');
    await basePage.waitForReady();

    const sidebar = basePage.getSidebar();
    await expect(sidebar).toBeVisible();
  });

  test('top bar renders', async ({ basePage }) => {
    await basePage.goto('/');
    await basePage.waitForReady();

    const topBar = basePage.getTopBar();
    await expect(topBar).toBeVisible();
  });

  test('admin page loads', async ({ basePage }) => {
    await basePage.goto('/admin');
    await basePage.waitForReady();

    // /admin redirects to /admin/cron-jobs
    await expect(basePage.page).toHaveURL(/\/admin\/cron-jobs/);
  });

  test('agents page loads', async ({ agentsPage }) => {
    await agentsPage.gotoList();
    await agentsPage.waitForReady();

    // Should see the seeded agent
    await expect(agentsPage.page.getByText('E2E Test Agent')).toBeVisible();
  });

  test('tasks page loads', async ({ tasksPage }) => {
    await tasksPage.gotoList();
    await tasksPage.waitForReady();

    // Should see at least one seeded task
    await expect(tasksPage.getTask('E2E Todo Task')).toBeVisible();
  });

  test('calendar page loads', async ({ calendarPage }) => {
    await calendarPage.gotoCalendar();
    await calendarPage.waitForReady();

    // Calendar should render with view tabs
    await expect(calendarPage.page.getByRole('tab', { name: 'Week' })).toBeVisible();
  });

  test('projects page loads', async ({ projectsPage }) => {
    await projectsPage.gotoList();
    await projectsPage.waitForReady();

    // Should see the seeded project
    await expect(projectsPage.page.getByText('E2E Test Project')).toBeVisible();
  });
});
