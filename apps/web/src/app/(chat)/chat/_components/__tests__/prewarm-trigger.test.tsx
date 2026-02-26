import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockPrewarmSession } = vi.hoisted(() => ({
  mockPrewarmSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../_actions/prewarm-session', () => ({
  prewarmSession: mockPrewarmSession,
}));

import { PrewarmTrigger } from '../prewarm-trigger';

describe('PrewarmTrigger', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders nothing (returns null)', () => {
    const { container } = render(<PrewarmTrigger threadId='thread-1' />);

    expect(container.innerHTML).toBe('');
  });

  it('calls prewarmSession on mount', () => {
    render(<PrewarmTrigger threadId='thread-1' />);

    expect(mockPrewarmSession).toHaveBeenCalledWith('thread-1');
  });

  it('calls prewarmSession with the correct threadId', () => {
    render(<PrewarmTrigger threadId='thread-xyz' />);

    expect(mockPrewarmSession).toHaveBeenCalledWith('thread-xyz');
  });

  it('calls prewarmSession only once per mount', () => {
    render(<PrewarmTrigger threadId='thread-1' />);

    expect(mockPrewarmSession).toHaveBeenCalledTimes(1);
  });
});
