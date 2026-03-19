import { expect, test } from '../fixtures';
import { TEST_TASKS } from '../setup/seed-data';

test.describe('tasks', () => {
  test('list page renders with seeded tasks', async ({ tasksPage }) => {
    await tasksPage.gotoList();
    await tasksPage.waitForReady();

    await expect(tasksPage.getHeading('Tasks')).toBeVisible();

    // Seeded tasks should be visible (Done tasks may be filtered out)
    await expect(tasksPage.getTask(TEST_TASKS.todo.title)).toBeVisible();
    await expect(tasksPage.getTask(TEST_TASKS.inProgress.title)).toBeVisible();
  });

  test('filter buttons are present', async ({ tasksPage }) => {
    await tasksPage.gotoList();
    await tasksPage.waitForReady();

    await expect(tasksPage.page.getByRole('button', { name: 'All', exact: true })).toBeVisible();
    await expect(tasksPage.page.getByRole('button', { name: 'To Do', exact: true })).toBeVisible();
    await expect(tasksPage.page.getByRole('button', { name: 'In Progress', exact: true })).toBeVisible();
    await expect(tasksPage.page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();
  });

  test('new task button is present', async ({ tasksPage }) => {
    await tasksPage.gotoList();
    await tasksPage.waitForReady();

    await expect(tasksPage.page.getByRole('button', { name: /new task/i })).toBeVisible();
  });

  test('create task via dialog', async ({ tasksPage }) => {
    await tasksPage.gotoList();
    await tasksPage.waitForReady();

    // Open create dialog
    await tasksPage.clickNewTask();

    // Dialog should be visible
    await expect(tasksPage.page.getByRole('heading', { name: 'Create Task' })).toBeVisible();

    // Fill form
    await tasksPage.page.locator('#task-title').fill('E2E Created Task');
    await tasksPage.page.locator('#task-description').fill('Created during E2E testing.');

    // Submit
    await tasksPage.page.getByRole('button', { name: 'Create Task' }).click();

    // Dialog should close and task should appear in list
    await expect(tasksPage.page.getByRole('heading', { name: 'Create Task' })).not.toBeVisible();
    await tasksPage.waitForReady();
    await expect(tasksPage.getTask('E2E Created Task')).toBeVisible();
  });

  test('task detail panel opens on click', async ({ tasksPage }) => {
    await tasksPage.gotoList();
    await tasksPage.waitForReady();

    // Click on a seeded task
    await tasksPage.getTask(TEST_TASKS.todo.title).click();

    // Detail panel should show task title
    await expect(
      tasksPage.page.getByRole('heading', {
        name: TEST_TASKS.todo.title,
      }),
    ).toBeVisible();

    // Status and priority selects should be visible
    await expect(tasksPage.page.getByText('Status', { exact: true })).toBeVisible();
    await expect(tasksPage.page.getByText('Priority', { exact: true })).toBeVisible();
  });
});
