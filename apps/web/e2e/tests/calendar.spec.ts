import { format } from 'date-fns';
import { expect, test } from '../fixtures';
import { TEST_CALENDAR_EVENTS } from '../setup/seed-data';

test.describe('calendar', () => {
  test('week view renders by default', async ({ calendarPage }) => {
    await calendarPage.gotoCalendar();
    await calendarPage.waitForReady();

    // Week tab should be active
    await expect(calendarPage.page.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true');

    // Current month/year should be displayed
    const currentMonth = format(new Date(), 'MMMM yyyy');
    await expect(calendarPage.getMonthLabel()).toHaveText(currentMonth);
  });

  test('seeded events appear in agenda view', async ({ calendarPage }) => {
    await calendarPage.gotoCalendar('agenda');
    await calendarPage.waitForReady();

    // Agenda view lists events as text — seeded events should be visible
    await expect(calendarPage.page.getByText(TEST_CALENDAR_EVENTS.today.title)).toBeVisible();
    await expect(calendarPage.page.getByText(TEST_CALENDAR_EVENTS.tomorrow.title)).toBeVisible();
  });

  test('prev/next navigation works', async ({ calendarPage }) => {
    await calendarPage.gotoCalendar();
    await calendarPage.waitForReady();

    // Previous and Next buttons should be accessible
    await expect(calendarPage.page.getByRole('button', { name: 'Previous' })).toBeVisible();
    await expect(calendarPage.page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();

    // Navigate forward then back
    const initialLabel = await calendarPage.getMonthLabel().textContent();
    await calendarPage.goNext();
    await calendarPage.goPrevious();
    await expect(calendarPage.getMonthLabel()).toHaveText(initialLabel!);
  });

  test('today button returns to current date', async ({ calendarPage }) => {
    await calendarPage.gotoCalendar();
    await calendarPage.waitForReady();

    // Navigate away from current week
    await calendarPage.goNext();
    await calendarPage.goNext();
    await calendarPage.goNext();

    // Click Today to return
    await calendarPage.goToday();

    // Should show current month again
    const currentMonth = format(new Date(), 'MMMM yyyy');
    await expect(calendarPage.getMonthLabel()).toHaveText(currentMonth);
  });

  test('view switching works', async ({ calendarPage }) => {
    await calendarPage.gotoCalendar();
    await calendarPage.waitForReady();

    // Switch to Day view
    await calendarPage.switchView('Day');
    await expect(calendarPage.page.getByRole('tab', { name: 'Day' })).toHaveAttribute('aria-selected', 'true');

    // Switch to Month view
    await calendarPage.switchView('Month');
    await expect(calendarPage.page.getByRole('tab', { name: 'Month' })).toHaveAttribute('aria-selected', 'true');

    // Switch to Agenda view
    await calendarPage.switchView('Agenda');
    await expect(calendarPage.page.getByRole('tab', { name: 'Agenda' })).toHaveAttribute('aria-selected', 'true');

    // Switch back to Week
    await calendarPage.switchView('Week');
    await expect(calendarPage.page.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true');
  });

  test('day view renders via URL param', async ({ calendarPage }) => {
    await calendarPage.gotoCalendar('day');
    await calendarPage.waitForReady();

    await expect(calendarPage.page.getByRole('tab', { name: 'Day' })).toHaveAttribute('aria-selected', 'true');
  });

  test('month view renders via URL param', async ({ calendarPage }) => {
    await calendarPage.gotoCalendar('month-grid');
    await calendarPage.waitForReady();

    await expect(calendarPage.page.getByRole('tab', { name: 'Month' })).toHaveAttribute('aria-selected', 'true');
  });

  test('source filter is present', async ({ calendarPage }) => {
    await calendarPage.gotoCalendar();
    await calendarPage.waitForReady();

    await expect(calendarPage.page.getByText('All sources')).toBeVisible();
  });

  test('search button is accessible', async ({ calendarPage }) => {
    await calendarPage.gotoCalendar();
    await calendarPage.waitForReady();

    await expect(calendarPage.page.getByRole('button', { name: 'Search events' })).toBeVisible();
  });
});
