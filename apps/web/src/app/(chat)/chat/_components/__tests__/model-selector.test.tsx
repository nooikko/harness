import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('renders a select element with model options', () => {
    render(<ModelSelector threadId='t1' currentModel={null} />);

    const select = screen.getByLabelText('Select model');
    expect(select).toBeDefined();
    expect(select.tagName).toBe('SELECT');
  });

  it('shows the current model as selected', () => {
    render(<ModelSelector threadId='t1' currentModel='claude-sonnet-4-6' />);

    const select = screen.getByLabelText('Select model') as HTMLSelectElement;
    expect(select.value).toBe('claude-sonnet-4-6');
  });

  it('defaults to empty string when currentModel is null', () => {
    render(<ModelSelector threadId='t1' currentModel={null} />);

    const select = screen.getByLabelText('Select model') as HTMLSelectElement;
    expect(select.value).toBe('');
  });

  it('calls updateThreadModel on change', () => {
    render(<ModelSelector threadId='t1' currentModel={null} />);

    const select = screen.getByLabelText('Select model') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'claude-opus-4-6' } });

    expect(updateThreadModel).toHaveBeenCalledWith('t1', 'claude-opus-4-6');
  });

  it('passes null when selecting the default option', () => {
    render(<ModelSelector threadId='t1' currentModel='claude-sonnet-4-6' />);

    const select = screen.getByLabelText('Select model') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '' } });

    expect(updateThreadModel).toHaveBeenCalledWith('t1', null);
  });

  it('renders all four model options', () => {
    render(<ModelSelector threadId='t1' currentModel={null} />);

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(4);
    expect(options.map((o) => o.textContent)).toEqual(['Default (Haiku)', 'Haiku', 'Sonnet', 'Opus']);
  });
});
