import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockDeleteCronJob = vi.fn();

vi.mock('../../_actions/delete-cron-job', () => ({
  deleteCronJob: (...args: unknown[]) => mockDeleteCronJob(...args),
}));

const { DeleteCronJobButton } = await import('../delete-cron-job-button');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DeleteCronJobButton', () => {
  it('renders a Delete button', () => {
    render(<DeleteCronJobButton id='cj_1' name='test-job' />);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDefined();
  });

  it('shows confirmation dialog on click', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<DeleteCronJobButton id='cj_1' name='test-job' />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete "test-job"?');
  });

  it('does not call deleteCronJob when confirm is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<DeleteCronJobButton id='cj_1' name='test-job' />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(mockDeleteCronJob).not.toHaveBeenCalled();
  });

  it('calls deleteCronJob when confirm is accepted', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockDeleteCronJob.mockResolvedValue({ success: true });
    render(<DeleteCronJobButton id='cj_1' name='test-job' />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(mockDeleteCronJob).toHaveBeenCalledWith('cj_1');
  });
});
