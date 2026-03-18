import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelSelector } from '../model-selector';

vi.mock('../../_actions/update-thread-model', () => ({
  updateThreadModel: vi.fn().mockResolvedValue(undefined),
}));

import { updateThreadModel } from '../../_actions/update-thread-model';

describe('ModelSelector', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders a trigger button (not a select element)', () => {
    render(<ModelSelector threadId='t1' currentModel={null} />);

    const trigger = screen.getByLabelText('Select model');
    expect(trigger.tagName).toBe('BUTTON');
  });

  it('shows "Haiku" label when currentModel is null', () => {
    render(<ModelSelector threadId='t1' currentModel={null} />);

    expect(screen.getByLabelText('Select model')).toHaveTextContent('Haiku');
  });

  it('shows correct label for a set model', () => {
    render(<ModelSelector threadId='t1' currentModel='claude-sonnet-4-6' />);

    expect(screen.getByLabelText('Select model')).toHaveTextContent('Sonnet');
  });

  it('opens dropdown with model options when trigger is clicked', async () => {
    const user = userEvent.setup();
    render(<ModelSelector threadId='t1' currentModel={null} />);

    await user.click(screen.getByLabelText('Select model'));

    expect(screen.getByText('Sonnet')).toBeInTheDocument();
    expect(screen.getByText('Opus')).toBeInTheDocument();
  });

  it('calls updateThreadModel with the selected model value', async () => {
    const user = userEvent.setup();
    render(<ModelSelector threadId='t1' currentModel={null} />);

    await user.click(screen.getByLabelText('Select model'));
    await user.click(screen.getByRole('menuitem', { name: /Sonnet/i }));

    expect(updateThreadModel).toHaveBeenCalledWith('t1', 'claude-sonnet-4-6');
  });

  it('calls updateThreadModel with null when selecting the default option', async () => {
    const user = userEvent.setup();
    render(<ModelSelector threadId='t1' currentModel='claude-sonnet-4-6' />);

    await user.click(screen.getByLabelText('Select model'));
    await user.click(screen.getByRole('menuitem', { name: /Default/i }));

    expect(updateThreadModel).toHaveBeenCalledWith('t1', null);
  });

  it('renders all four model options in the open dropdown', async () => {
    const user = userEvent.setup();
    render(<ModelSelector threadId='t1' currentModel={null} />);

    await user.click(screen.getByLabelText('Select model'));

    expect(screen.getAllByRole('menuitem')).toHaveLength(4);
  });
});
