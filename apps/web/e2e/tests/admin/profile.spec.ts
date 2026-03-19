import { expect, test } from '../../fixtures';
import { TEST_PROFILE } from '../../setup/seed-data';

test.describe('profile admin', () => {
  test('profile page renders with seeded data', async ({ profilePage }) => {
    await profilePage.gotoProfile();
    await profilePage.waitForReady();

    await expect(profilePage.getHeading('Profile')).toBeVisible();

    // Seeded profile data should be pre-filled
    await expect(profilePage.page.locator('#name')).toHaveValue(TEST_PROFILE.name);
    await expect(profilePage.page.locator('#pronouns')).toHaveValue(TEST_PROFILE.pronouns);
    await expect(profilePage.page.locator('#location')).toHaveValue(TEST_PROFILE.location);
  });

  test('edit and save profile', async ({ profilePage }) => {
    await profilePage.gotoProfile();
    await profilePage.waitForReady();

    // Clear and fill with new values
    await profilePage.page.locator('#name').clear();
    await profilePage.page.locator('#name').fill('Updated Name');

    await profilePage.page.locator('#pronouns').clear();
    await profilePage.page.locator('#pronouns').fill('he/him');

    await profilePage.page.locator('#location').clear();
    await profilePage.page.locator('#location').fill('New City, NC');

    // Save
    await profilePage.submit();

    // Button should show "Saved" state
    await expect(profilePage.page.getByRole('button', { name: /saved/i })).toBeVisible();

    // Reload and verify persistence
    await profilePage.page.reload();
    await profilePage.waitForReady();

    await expect(profilePage.page.locator('#name')).toHaveValue('Updated Name');
    await expect(profilePage.page.locator('#pronouns')).toHaveValue('he/him');
    await expect(profilePage.page.locator('#location')).toHaveValue('New City, NC');
  });

  test('profile form has all field sections', async ({ profilePage }) => {
    await profilePage.gotoProfile();
    await profilePage.waitForReady();

    // Identity card
    await expect(profilePage.page.getByText("How you'd like to be addressed")).toBeVisible();

    // Location & Interests card
    await expect(profilePage.page.getByText('Context that helps your AI understand you better')).toBeVisible();

    // About card
    await expect(profilePage.page.getByText("Anything else you'd like your AI to know about you")).toBeVisible();

    // Check all input fields exist
    await expect(profilePage.page.locator('#name')).toBeVisible();
    await expect(profilePage.page.locator('#pronouns')).toBeVisible();
    await expect(profilePage.page.locator('#age')).toBeVisible();
    await expect(profilePage.page.locator('#gender')).toBeVisible();
    await expect(profilePage.page.locator('#location')).toBeVisible();
    await expect(profilePage.page.locator('#interests')).toBeVisible();
    await expect(profilePage.page.locator('#bio')).toBeVisible();
  });
});
