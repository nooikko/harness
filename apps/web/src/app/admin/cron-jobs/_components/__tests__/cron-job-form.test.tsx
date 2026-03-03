import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockCreateCronJob = vi.fn();
const mockUpdateCronJob = vi.fn();

vi.mock('../../_actions/create-cron-job', () => ({
  createCronJob: (...args: unknown[]) => mockCreateCronJob(...args),
}));

vi.mock('../../_actions/update-cron-job', () => ({
  updateCronJob: (...args: unknown[]) => mockUpdateCronJob(...args),
}));

const { CronJobForm } = await import('../cron-job-form');

const defaultProps = {
  mode: 'create' as const,
  agents: [
    { id: 'agent_1', name: 'Claude' },
    { id: 'agent_2', name: 'Aria' },
  ],
  threads: [
    { id: 'thread_1', name: 'Thread A', agentId: 'agent_1' },
    { id: 'thread_2', name: 'Thread B', agentId: 'agent_2' },
  ],
  projects: [{ id: 'proj_1', name: 'Main Project' }],
};

describe('CronJobForm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders create mode title', () => {
    render(<CronJobForm {...defaultProps} />);
    expect(screen.getByText('Create Cron Job')).toBeInTheDocument();
  });

  it('renders edit mode title', () => {
    render(<CronJobForm {...defaultProps} mode='edit' />);
    expect(screen.getByText('Edit Cron Job')).toBeInTheDocument();
  });

  it('renders the name input', () => {
    render(<CronJobForm {...defaultProps} />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('renders the prompt textarea', () => {
    render(<CronJobForm {...defaultProps} />);
    expect(screen.getByLabelText('Prompt')).toBeInTheDocument();
  });

  it('renders the enabled checkbox', () => {
    render(<CronJobForm {...defaultProps} />);
    expect(screen.getByLabelText('Enabled')).toBeInTheDocument();
  });

  it('renders the Recurring button as default schedule type', () => {
    render(<CronJobForm {...defaultProps} />);
    expect(screen.getByText('Recurring')).toBeInTheDocument();
    expect(screen.getByText('One-shot')).toBeInTheDocument();
  });

  it('shows schedule input for recurring type', () => {
    render(<CronJobForm {...defaultProps} />);
    expect(screen.getByLabelText('Schedule')).toBeInTheDocument();
  });

  it('shows fire-at input after clicking One-shot button', () => {
    render(<CronJobForm {...defaultProps} />);
    fireEvent.click(screen.getByText('One-shot'));
    expect(screen.getByLabelText('Fire At')).toBeInTheDocument();
  });

  it('switches back to schedule input after clicking Recurring', () => {
    render(<CronJobForm {...defaultProps} />);
    fireEvent.click(screen.getByText('One-shot'));
    expect(screen.getByLabelText('Fire At')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Recurring'));
    expect(screen.getByLabelText('Schedule')).toBeInTheDocument();
  });

  it('renders Cancel and submit buttons', () => {
    render(<CronJobForm {...defaultProps} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Create Job')).toBeInTheDocument();
  });

  it('renders Save Changes button in edit mode', () => {
    render(<CronJobForm {...defaultProps} mode='edit' />);
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('populates default values in edit mode', () => {
    render(
      <CronJobForm
        {...defaultProps}
        mode='edit'
        defaultValues={{
          id: 'cj_1',
          name: 'Morning Digest',
          agentId: 'agent_1',
          schedule: '0 14 * * *',
          prompt: 'Summarize the day',
          enabled: true,
        }}
      />,
    );
    expect(screen.getByLabelText('Name')).toHaveValue('Morning Digest');
    expect(screen.getByLabelText('Prompt')).toHaveValue('Summarize the day');
    expect(screen.getByLabelText('Schedule')).toHaveValue('0 14 * * *');
    expect(screen.getByLabelText('Enabled')).toBeChecked();
  });

  it('shows one-shot type when defaultValues has fireAt', () => {
    render(
      <CronJobForm
        {...defaultProps}
        mode='edit'
        defaultValues={{
          id: 'cj_1',
          name: 'One-time',
          agentId: 'agent_1',
          fireAt: '2026-06-01T10:00:00.000Z',
          prompt: 'Run once',
          enabled: true,
        }}
      />,
    );
    expect(screen.getByLabelText('Fire At')).toBeInTheDocument();
  });

  it('allows toggling the enabled checkbox', () => {
    render(<CronJobForm {...defaultProps} />);
    const checkbox = screen.getByLabelText('Enabled');
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('allows typing in the name input', () => {
    render(<CronJobForm {...defaultProps} />);
    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'New Job' } });
    expect(nameInput).toHaveValue('New Job');
  });

  it('allows typing in the prompt textarea', () => {
    render(<CronJobForm {...defaultProps} />);
    const promptInput = screen.getByLabelText('Prompt');
    fireEvent.change(promptInput, { target: { value: 'Do something' } });
    expect(promptInput).toHaveValue('Do something');
  });

  it('allows typing in the schedule input', () => {
    render(<CronJobForm {...defaultProps} />);
    const scheduleInput = screen.getByLabelText('Schedule');
    fireEvent.change(scheduleInput, { target: { value: '0 9 * * *' } });
    expect(scheduleInput).toHaveValue('0 9 * * *');
  });

  it('navigates to cron-jobs list when Cancel is clicked', () => {
    render(<CronJobForm {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockPush).toHaveBeenCalledWith('/admin/cron-jobs');
  });

  it('calls createCronJob and redirects on successful create', async () => {
    mockCreateCronJob.mockResolvedValue({ id: 'new_job' });
    render(<CronJobForm {...defaultProps} defaultValues={{ agentId: 'agent_1' }} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test Job' } });
    fireEvent.change(screen.getByLabelText('Schedule'), { target: { value: '0 9 * * *' } });
    fireEvent.change(screen.getByLabelText('Prompt'), { target: { value: 'Do it' } });
    fireEvent.submit(screen.getByLabelText('Prompt').closest('form')!);

    await vi.waitFor(() => {
      expect(mockCreateCronJob).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Job',
          agentId: 'agent_1',
          schedule: '0 9 * * *',
          prompt: 'Do it',
          enabled: true,
        }),
      );
    });
  });

  it('shows error when createCronJob returns error', async () => {
    mockCreateCronJob.mockResolvedValue({ error: 'Name already taken' });
    render(<CronJobForm {...defaultProps} defaultValues={{ agentId: 'agent_1' }} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dup' } });
    fireEvent.change(screen.getByLabelText('Schedule'), { target: { value: '0 9 * * *' } });
    fireEvent.change(screen.getByLabelText('Prompt'), { target: { value: 'x' } });
    fireEvent.submit(screen.getByLabelText('Prompt').closest('form')!);

    await vi.waitFor(() => {
      expect(screen.getByText('Name already taken')).toBeInTheDocument();
    });
  });

  it('calls updateCronJob and shows success on edit', async () => {
    mockUpdateCronJob.mockResolvedValue({ id: 'cj_1' });
    render(
      <CronJobForm
        {...defaultProps}
        mode='edit'
        defaultValues={{
          id: 'cj_1',
          name: 'Existing Job',
          agentId: 'agent_1',
          schedule: '0 14 * * *',
          prompt: 'Old prompt',
          enabled: true,
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText('Prompt'), { target: { value: 'New prompt' } });
    fireEvent.submit(screen.getByLabelText('Prompt').closest('form')!);

    await vi.waitFor(() => {
      expect(mockUpdateCronJob).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'cj_1',
          prompt: 'New prompt',
        }),
      );
    });

    await vi.waitFor(() => {
      expect(screen.getByText('Cron job updated successfully.')).toBeInTheDocument();
    });
  });

  it('shows error when updateCronJob returns error', async () => {
    mockUpdateCronJob.mockResolvedValue({ error: 'Update failed' });
    render(
      <CronJobForm
        {...defaultProps}
        mode='edit'
        defaultValues={{
          id: 'cj_1',
          name: 'Job',
          agentId: 'agent_1',
          schedule: '0 14 * * *',
          prompt: 'p',
          enabled: true,
        }}
      />,
    );

    fireEvent.submit(screen.getByLabelText('Prompt').closest('form')!);

    await vi.waitFor(() => {
      expect(screen.getByText('Update failed')).toBeInTheDocument();
    });
  });

  it('submits one-shot job with fireAt instead of schedule', async () => {
    mockCreateCronJob.mockResolvedValue({ id: 'new_job' });
    render(<CronJobForm {...defaultProps} defaultValues={{ agentId: 'agent_1' }} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'One-timer' } });
    fireEvent.click(screen.getByText('One-shot'));
    fireEvent.change(screen.getByLabelText('Fire At'), { target: { value: '2026-06-01T10:00' } });
    fireEvent.change(screen.getByLabelText('Prompt'), { target: { value: 'Fire once' } });
    fireEvent.submit(screen.getByLabelText('Prompt').closest('form')!);

    await vi.waitFor(() => {
      expect(mockCreateCronJob).toHaveBeenCalledWith(
        expect.objectContaining({
          fireAt: '2026-06-01T10:00',
          schedule: undefined,
        }),
      );
    });
  });

  it('populates fireAt in datetime-local format from ISO default value', () => {
    render(
      <CronJobForm
        {...defaultProps}
        mode='edit'
        defaultValues={{
          id: 'cj_1',
          name: 'One-time',
          agentId: 'agent_1',
          fireAt: '2026-06-15T14:30:00.000Z',
          prompt: 'Do it',
          enabled: true,
        }}
      />,
    );
    const fireAtInput = screen.getByLabelText('Fire At') as HTMLInputElement;
    // Should be formatted as YYYY-MM-DDTHH:mm (local time)
    expect(fireAtInput.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('renders disabled checkbox when defaultValues.enabled is false', () => {
    render(
      <CronJobForm
        {...defaultProps}
        mode='edit'
        defaultValues={{
          id: 'cj_1',
          name: 'Disabled Job',
          agentId: 'agent_1',
          schedule: '0 0 * * *',
          prompt: 'p',
          enabled: false,
        }}
      />,
    );
    expect(screen.getByLabelText('Enabled')).not.toBeChecked();
  });
});
