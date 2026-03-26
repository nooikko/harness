import { expect, test } from '../fixtures';
import { TEST_AGENT } from '../setup/seed-data';

test.describe('agents', () => {
  test('list page renders with seeded agent', async ({ agentsPage }) => {
    await agentsPage.gotoList();
    await agentsPage.waitForReady();

    await expect(agentsPage.getHeading('Agents')).toBeVisible();
    await expect(agentsPage.page.getByText(TEST_AGENT.name)).toBeVisible();

    // Agent card should show Enabled badge
    await expect(agentsPage.page.getByText('Enabled').first()).toBeVisible();
  });

  test('new agent button navigates to create form', async ({ agentsPage }) => {
    await agentsPage.gotoList();
    await agentsPage.waitForReady();

    await agentsPage.page.getByRole('link', { name: /new agent/i }).click();
    await expect(agentsPage.page).toHaveURL(/\/agents\/new/);
    await expect(agentsPage.getHeading('New Agent')).toBeVisible();
  });

  test('create form has all required fields', async ({ agentsPage }) => {
    await agentsPage.gotoNew();
    await agentsPage.waitForReady();

    // Identity card
    await expect(agentsPage.page.locator('#agent-name')).toBeVisible();
    await expect(agentsPage.page.locator('#agent-slug')).toBeVisible();

    // Personality card
    await expect(agentsPage.page.locator('#agent-soul')).toBeVisible();
    await expect(agentsPage.page.locator('#agent-identity')).toBeVisible();

    // Character card (optional)
    await expect(agentsPage.page.locator('#agent-role')).toBeVisible();
    await expect(agentsPage.page.locator('#agent-goal')).toBeVisible();
    await expect(agentsPage.page.locator('#agent-backstory')).toBeVisible();

    // Action buttons
    await expect(agentsPage.page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(agentsPage.page.getByRole('button', { name: 'Create Agent' })).toBeVisible();
  });

  test('slug auto-derives from name', async ({ agentsPage }) => {
    await agentsPage.gotoNew();
    await agentsPage.waitForReady();

    await agentsPage.page.locator('#agent-name').fill('My Test Agent');

    // Slug should auto-derive
    await expect(agentsPage.page.locator('#agent-slug')).toHaveValue('my-test-agent');
  });

  test('create agent and verify redirect', async ({ agentsPage }) => {
    await agentsPage.gotoNew();
    await agentsPage.waitForReady();

    // Fill required fields
    await agentsPage.page.locator('#agent-name').fill('E2E Created Agent');
    await agentsPage.page.locator('#agent-soul').fill('A test agent created by E2E tests.');
    await agentsPage.page.locator('#agent-identity').fill('I am a test identity.');

    // Submit
    await agentsPage.page.getByRole('button', { name: 'Create Agent' }).click();

    // Should show "Created" state then navigate back to list
    await agentsPage.page.waitForURL(/\/agents$/, { timeout: 5000 });
    await agentsPage.waitForReady();

    // New agent should appear in the list
    await expect(agentsPage.page.getByText('E2E Created Agent')).toBeVisible();
  });

  test('edit agent detail page loads with prefilled data', async ({ agentsPage }) => {
    await agentsPage.gotoList();
    await agentsPage.waitForReady();

    // The seeded agent sorts after "E2E Created Agent" alphabetically, so it's the second Edit button
    await agentsPage.page.getByRole('button', { name: 'Edit' }).nth(1).click();

    // Should be on the edit page
    await agentsPage.waitForReady();

    // Name should be prefilled
    await expect(agentsPage.page.locator('#edit-agent-name')).toHaveValue(TEST_AGENT.name);

    // Config switches should be visible
    await expect(agentsPage.page.locator('#edit-agent-memory-enabled')).toBeVisible();
    await expect(agentsPage.page.locator('#edit-agent-reflection-enabled')).toBeVisible();
  });

  test('delete agent from list (two-click confirm)', async ({ agentsPage }) => {
    // First create an agent to delete
    await agentsPage.gotoNew();
    await agentsPage.waitForReady();

    await agentsPage.page.locator('#agent-name').fill('Agent To Delete');
    await agentsPage.page.locator('#agent-soul').fill('Deletable agent soul.');
    await agentsPage.page.locator('#agent-identity').fill('Deletable identity.');

    await agentsPage.page.getByRole('button', { name: 'Create Agent' }).click();
    await agentsPage.page.waitForURL(/\/agents$/, { timeout: 5000 });
    await agentsPage.waitForReady();

    // "Agent To Delete" sorts first alphabetically, so it's the first card.
    // Click its Delete button (first of all Delete buttons on page).
    await agentsPage.page.getByRole('button', { name: 'Delete' }).first().click();

    // Should show "Confirm?" (second click)
    await agentsPage.page
      .getByRole('button', { name: /confirm/i })
      .first()
      .click();

    // Agent should be gone
    await expect(agentsPage.page.getByText('Agent To Delete')).not.toBeVisible();
  });
});
