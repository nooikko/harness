import { expect, test } from '../fixtures';
import { TEST_PROJECT } from '../setup/seed-data';

test.describe('projects', () => {
  test('list page renders with seeded project', async ({ projectsPage }) => {
    await projectsPage.gotoList();
    await projectsPage.waitForReady();

    await expect(projectsPage.getHeading('Projects')).toBeVisible();
    await expect(projectsPage.page.getByText(TEST_PROJECT.name)).toBeVisible();
  });

  test('new project button navigates to create form', async ({ projectsPage }) => {
    await projectsPage.gotoList();
    await projectsPage.waitForReady();

    await projectsPage.page.getByRole('link', { name: /new project/i }).click();
    await expect(projectsPage.page).toHaveURL(/\/chat\/projects\/new/);
    await expect(projectsPage.getHeading('New Project')).toBeVisible();
  });

  test('create form has all fields', async ({ projectsPage }) => {
    await projectsPage.gotoNew();
    await projectsPage.waitForReady();

    // Details card
    await expect(projectsPage.page.locator('#proj-name')).toBeVisible();
    await expect(projectsPage.page.locator('#proj-description')).toBeVisible();
    await expect(projectsPage.page.locator('#proj-model')).toBeVisible();

    // Instructions card
    await expect(projectsPage.page.locator('#proj-instructions')).toBeVisible();

    // Action buttons
    await expect(projectsPage.page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(projectsPage.page.getByRole('button', { name: 'Create Project' })).toBeVisible();
  });

  test('create project and verify redirect', async ({ projectsPage }) => {
    await projectsPage.gotoNew();
    await projectsPage.waitForReady();

    await projectsPage.page.locator('#proj-name').fill('E2E Created Project');
    await projectsPage.page.locator('#proj-description').fill('A project created during E2E testing.');

    await projectsPage.page.getByRole('button', { name: 'Create Project' }).click();

    // Should navigate back to project list
    await projectsPage.page.waitForURL(/\/chat\/projects$/, { timeout: 5000 });
    await projectsPage.waitForReady();

    // New project should appear in the list
    await expect(projectsPage.page.getByText('E2E Created Project')).toBeVisible();
  });

  test('project hub page renders', async ({ projectsPage }) => {
    await projectsPage.gotoList();
    await projectsPage.waitForReady();

    // Click the seeded project card to go to hub
    await projectsPage.clickProject(TEST_PROJECT.name);
    await projectsPage.waitForReady();

    // Hub should show the project name as heading
    await expect(projectsPage.getHeading(TEST_PROJECT.name)).toBeVisible();

    // Should have the thread input
    await expect(projectsPage.page.getByPlaceholder(/start a new chat in this project/i)).toBeVisible();

    // Should show recent threads heading
    await expect(projectsPage.page.getByText('Recent threads')).toBeVisible();

    // Right column panels
    await expect(projectsPage.page.getByText('Memory', { exact: true })).toBeVisible();
    await expect(projectsPage.page.getByText('Instructions', { exact: true })).toBeVisible();
  });

  test('project settings page loads and can save', async ({ projectsPage }) => {
    await projectsPage.gotoList();
    await projectsPage.waitForReady();

    // Navigate to hub then settings
    await projectsPage.clickProject(TEST_PROJECT.name);
    await projectsPage.waitForReady();

    // Click settings icon
    await projectsPage.page.getByRole('link', { name: /settings/i }).click();
    await projectsPage.waitForReady();

    await expect(projectsPage.getHeading('Project Settings')).toBeVisible();

    // Name should be prefilled
    await expect(projectsPage.page.locator('#proj-name')).toHaveValue(TEST_PROJECT.name);

    // Modify name
    await projectsPage.page.locator('#proj-name').clear();
    await projectsPage.page.locator('#proj-name').fill('Updated Project Name');

    await projectsPage.page.getByRole('button', { name: 'Save Changes' }).click();

    // Should navigate back to hub with updated name
    await projectsPage.waitForReady();
    await expect(projectsPage.getHeading('Updated Project Name')).toBeVisible();

    // Restore original name so other tests are not affected
    await projectsPage.page.getByRole('link', { name: /settings/i }).click();
    await projectsPage.waitForReady();
    await projectsPage.page.locator('#proj-name').clear();
    await projectsPage.page.locator('#proj-name').fill(TEST_PROJECT.name);
    await projectsPage.page.getByRole('button', { name: 'Save Changes' }).click();
    await projectsPage.waitForReady();
  });
});
