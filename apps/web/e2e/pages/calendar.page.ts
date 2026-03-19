import { BasePage } from './base.page';

export class CalendarPage extends BasePage {
  gotoCalendar = async (view?: 'week' | 'day' | 'month-grid' | 'agenda'): Promise<void> => {
    const params = view ? `?view=${view}` : '';
    await this.goto(`/calendar${params}`);
  };

  goNext = async (): Promise<void> => {
    await this.page.getByRole('button', { name: 'Next', exact: true }).click();
  };

  goPrevious = async (): Promise<void> => {
    await this.page.getByRole('button', { name: 'Previous' }).click();
  };

  /** Click the Today button (mini date card in the header). */
  goToday = async (): Promise<void> => {
    // The Today button shows the current month abbreviation + day number
    // Try aria-label first, fall back to matching the day number text
    const todayBtn = this.page.getByRole('button', { name: /today/i });
    if ((await todayBtn.count()) > 0) {
      await todayBtn.click();
    } else {
      // Fallback: find the mini date card by its structure (10x10 card with day number)
      await this.page
        .locator('button')
        .filter({ hasText: String(new Date().getDate()) })
        .first()
        .click();
    }
  };

  /** Get the currently displayed month/year label (the animated span in the header). */
  getMonthLabel = () => this.page.getByText(/\w+ \d{4}/).first();

  /** Switch to a specific view tab. */
  switchView = async (view: string): Promise<void> => {
    await this.page.getByRole('tab', { name: view }).click();
  };
}
