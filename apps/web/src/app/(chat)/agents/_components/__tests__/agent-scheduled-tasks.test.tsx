import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentScheduledTasks } from '../agent-scheduled-tasks';

const baseTask = {
  id: 'task-1',
  name: 'Daily Digest',
  schedule: '0 14 * * *' as string | null,
  fireAt: null as Date | null,
  enabled: true,
  lastRunAt: null as Date | null,
  nextRunAt: null as Date | null,
};

describe('AgentScheduledTasks', () => {
  it('renders the section heading', () => {
    render(<AgentScheduledTasks tasks={[]} agentId='agent-1' />);
    expect(screen.getByText('Scheduled Tasks')).toBeInTheDocument();
  });

  it('renders empty state when no tasks', () => {
    render(<AgentScheduledTasks tasks={[]} agentId='agent-1' />);
    expect(screen.getByText('No scheduled tasks. Create one to automate agent invocations.')).toBeInTheDocument();
  });

  it('renders the Add Scheduled Task link with correct href', () => {
    render(<AgentScheduledTasks tasks={[]} agentId='agent-42' />);
    const link = screen.getByRole('link', { name: 'Add Task' });
    expect(link).toHaveAttribute('href', '/admin/cron-jobs/new?agentId=agent-42');
  });

  it('renders a table row for each task', () => {
    const tasks = [
      { ...baseTask, id: 't1', name: 'Task One' },
      { ...baseTask, id: 't2', name: 'Task Two' },
    ];
    render(<AgentScheduledTasks tasks={tasks} agentId='agent-1' />);
    expect(screen.getByText('Task One')).toBeInTheDocument();
    expect(screen.getByText('Task Two')).toBeInTheDocument();
  });

  it('shows Recurring badge when task has a schedule', () => {
    const tasks = [{ ...baseTask, schedule: '0 9 * * *', fireAt: null }];
    render(<AgentScheduledTasks tasks={tasks} agentId='agent-1' />);
    expect(screen.getByText('Recurring')).toBeInTheDocument();
  });

  it('shows One-shot badge when task has no schedule', () => {
    const tasks = [
      {
        ...baseTask,
        schedule: null,
        fireAt: new Date('2026-04-01T10:00:00Z'),
      },
    ];
    render(<AgentScheduledTasks tasks={tasks} agentId='agent-1' />);
    expect(screen.getByText('One-shot')).toBeInTheDocument();
  });

  it('shows Enabled badge when task is enabled', () => {
    const tasks = [{ ...baseTask, enabled: true }];
    render(<AgentScheduledTasks tasks={tasks} agentId='agent-1' />);
    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });

  it('shows Disabled badge when task is disabled', () => {
    const tasks = [{ ...baseTask, enabled: false }];
    render(<AgentScheduledTasks tasks={tasks} agentId='agent-1' />);
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('displays schedule string for recurring tasks', () => {
    const tasks = [{ ...baseTask, schedule: '*/5 * * * *' }];
    render(<AgentScheduledTasks tasks={tasks} agentId='agent-1' />);
    expect(screen.getByText('*/5 * * * *')).toBeInTheDocument();
  });

  it('displays formatted fireAt date for one-shot tasks', () => {
    const fireAt = new Date('2026-06-15T14:30:00Z');
    const tasks = [{ ...baseTask, schedule: null, fireAt }];
    render(<AgentScheduledTasks tasks={tasks} agentId='agent-1' />);
    // The component calls new Date(task.fireAt).toLocaleString()
    expect(screen.getByText(new Date(fireAt).toLocaleString())).toBeInTheDocument();
  });

  it('displays dash when neither schedule nor fireAt is set', () => {
    const tasks = [{ ...baseTask, schedule: null, fireAt: null }];
    render(<AgentScheduledTasks tasks={tasks} agentId='agent-1' />);
    // The table cell for schedule should show em-dash
    const cells = screen.getAllByRole('cell');
    const scheduleCell = cells[2]; // 3rd cell is Schedule / Fire At
    expect(scheduleCell).toHaveTextContent('\u2014');
  });

  it("displays 'just now' for lastRunAt within the last hour", () => {
    const recentDate = new Date(Date.now() - 1000 * 60 * 10); // 10 min ago
    const tasks = [{ ...baseTask, lastRunAt: recentDate }];
    render(<AgentScheduledTasks tasks={tasks} agentId='agent-1' />);
    expect(screen.getByText('just now')).toBeInTheDocument();
  });

  it('displays hours ago for lastRunAt within the last day', () => {
    const hoursAgo = new Date(Date.now() - 1000 * 60 * 60 * 5); // 5h ago
    const tasks = [{ ...baseTask, lastRunAt: hoursAgo }];
    render(<AgentScheduledTasks tasks={tasks} agentId='agent-1' />);
    expect(screen.getByText('5h ago')).toBeInTheDocument();
  });

  it('displays days ago for lastRunAt older than a day but less than 30 days', () => {
    const daysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7); // 7d ago
    const tasks = [{ ...baseTask, lastRunAt: daysAgo }];
    render(<AgentScheduledTasks tasks={tasks} agentId='agent-1' />);
    expect(screen.getByText('7d ago')).toBeInTheDocument();
  });

  it('displays locale date string for lastRunAt older than 30 days', () => {
    const oldDate = new Date('2025-01-01T00:00:00Z');
    const tasks = [{ ...baseTask, lastRunAt: oldDate }];
    render(<AgentScheduledTasks tasks={tasks} agentId='agent-1' />);
    expect(screen.getByText(new Date(oldDate).toLocaleDateString())).toBeInTheDocument();
  });

  it('displays dash for null lastRunAt', () => {
    const tasks = [{ ...baseTask, lastRunAt: null }];
    render(<AgentScheduledTasks tasks={tasks} agentId='agent-1' />);
    // Last cell in the row should contain em-dash
    const cells = screen.getAllByRole('cell');
    const lastRunCell = cells[4]; // 5th cell is Last Run
    expect(lastRunCell).toHaveTextContent('\u2014');
  });
});
