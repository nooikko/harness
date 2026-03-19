import { expect, test } from '../fixtures';
import { TEST_THREADS } from '../setup/seed-data';

test.describe('thread management', () => {
  test('thread page loads via sidebar navigation', async ({ threadPage }) => {
    // Navigate to root, which redirects to a thread
    await threadPage.goto('/');
    await threadPage.waitForReady();

    // Click on the seeded general thread in the sidebar
    const sidebar = threadPage.getSidebar();
    await sidebar.getByText(TEST_THREADS.general.name, { exact: true }).click();
    await threadPage.waitForReady();

    // Thread page should show the header with thread name
    await expect(threadPage.page.getByText(TEST_THREADS.general.name)).toBeVisible();

    // Chat input should be present
    await expect(threadPage.page.getByRole('button', { name: 'Send message' })).toBeVisible();
  });

  test('new chat page renders', async ({ threadPage }) => {
    await threadPage.gotoNewChat();
    await threadPage.waitForReady();

    // Should show the empty state
    await expect(threadPage.page.getByText('Start a new conversation')).toBeVisible();

    // Input area should have the placeholder
    await expect(threadPage.page.getByPlaceholder(/send a message to start a new chat/i)).toBeVisible();
  });

  test('manage thread modal opens with settings fields', async ({ threadPage }) => {
    // Navigate to a seeded thread
    await threadPage.goto('/');
    await threadPage.waitForReady();
    const sidebar = threadPage.getSidebar();
    await sidebar.getByText(TEST_THREADS.general.name, { exact: true }).click();
    await threadPage.waitForReady();

    // Click the settings button to open the manage modal
    await threadPage.page.getByRole('button', { name: 'Thread settings' }).click();

    // Modal should open with "Chat Settings" title
    await expect(threadPage.page.getByRole('heading', { name: 'Chat Settings' })).toBeVisible();

    // Form fields should be present
    await expect(threadPage.page.locator('#thread-name')).toBeVisible();
    await expect(threadPage.page.getByText('Model', { exact: true })).toBeVisible();
    await expect(threadPage.page.locator('#thread-instructions')).toBeVisible();

    // Save button should be present
    await expect(threadPage.page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('thread name is pre-filled in manage modal', async ({ threadPage }) => {
    await threadPage.goto('/');
    await threadPage.waitForReady();

    // Click on the general thread in sidebar and wait for it to load
    const sidebar = threadPage.getSidebar();
    await sidebar.getByText(TEST_THREADS.general.name, { exact: true }).click();
    await threadPage.page.waitForLoadState('networkidle');

    // Verify the thread name appears in the header
    await expect(threadPage.page.getByText(TEST_THREADS.general.name)).toBeVisible();

    // Open manage modal
    await threadPage.page.getByRole('button', { name: 'Thread settings' }).click();
    await expect(threadPage.page.getByRole('heading', { name: 'Chat Settings' })).toBeVisible();

    // Name field should have the current thread name
    const nameInput = threadPage.page.locator('#thread-name');
    await expect(nameInput).toBeVisible();
    const value = await nameInput.inputValue();
    expect(value).toBeTruthy();
  });

  test('new chat has agent and model selectors', async ({ threadPage }) => {
    await threadPage.gotoNewChat();
    await threadPage.waitForReady();

    // Agent selector should be present
    await expect(threadPage.page.getByRole('button', { name: 'Select agent' })).toBeVisible();

    // Model selector should be present
    await expect(threadPage.page.getByRole('button', { name: 'Select model' })).toBeVisible();
  });
});
