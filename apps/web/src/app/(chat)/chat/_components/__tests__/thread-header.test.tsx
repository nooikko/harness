import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../manage-thread-modal', () => ({
  ManageThreadModal: ({ open }: { open: boolean }) => (open ? <div data-testid='manage-modal'>manage</div> : null),
}));

vi.mock('../thread-attachments-panel', () => ({
  ThreadAttachmentsPanel: ({ open }: { open: boolean }) => (open ? <div data-testid='attachments-panel'>attachments</div> : null),
}));

vi.mock('@harness/ui', () => ({
  Button: ({ children, ...props }: React.ComponentPropsWithoutRef<'button'>) => <button {...props}>{children}</button>,
}));

import { ThreadHeader } from '../thread-header';

const baseProps = {
  threadId: 't1',
  displayName: 'My Thread',
  currentName: 'My Thread',
  currentModel: null,
  currentEffort: null,
  currentInstructions: null,
  currentProjectId: null,
  projects: [],
};

describe('ThreadHeader', () => {
  it('renders the display name', () => {
    render(<ThreadHeader {...baseProps} />);
    expect(screen.getByText('My Thread')).toBeInTheDocument();
  });

  it('opens attachments panel when paperclip button is clicked', async () => {
    const user = userEvent.setup();
    render(<ThreadHeader {...baseProps} />);

    expect(screen.queryByTestId('attachments-panel')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Thread attachments'));
    expect(screen.getByTestId('attachments-panel')).toBeInTheDocument();
  });

  it('opens manage modal when settings button is clicked', async () => {
    const user = userEvent.setup();
    render(<ThreadHeader {...baseProps} />);

    expect(screen.queryByTestId('manage-modal')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Thread settings'));
    expect(screen.getByTestId('manage-modal')).toBeInTheDocument();
  });
});
