import { describe, expect, it, vi } from 'vitest';

const mockRedirect = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
  },
}));

const { default: AdminPage } = await import('../page');

describe('AdminPage', () => {
  it('redirects to /admin/cron-jobs', () => {
    AdminPage();
    expect(mockRedirect).toHaveBeenCalledWith('/admin/cron-jobs');
  });

  it('calls redirect exactly once', () => {
    mockRedirect.mockClear();
    AdminPage();
    expect(mockRedirect).toHaveBeenCalledTimes(1);
  });
});
