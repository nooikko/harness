import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../file-chip', () => ({
  FileChip: ({ file, onClick }: { file: { name: string }; onClick?: () => void }) => (
    <button type='button' data-testid={`chip-${file.name}`} onClick={onClick}>
      {file.name}
    </button>
  ),
}));

vi.mock('../file-preview-modal', () => ({
  FilePreviewModal: ({ file, open, onOpenChange }: { file: { name: string } | null; open: boolean; onOpenChange: (v: boolean) => void }) =>
    open && file ? (
      <div data-testid='preview-modal'>
        {file.name}
        <button type='button' data-testid='close-modal' onClick={() => onOpenChange(false)}>
          close
        </button>
      </div>
    ) : null,
}));

import { MessageFiles } from '../message-files';

const files = [
  { id: 'f1', name: 'doc.pdf', mimeType: 'application/pdf', size: 1024 },
  { id: 'f2', name: 'photo.png', mimeType: 'image/png', size: 2048 },
];

describe('MessageFiles', () => {
  it('returns null when files array is empty', () => {
    const { container } = render(<MessageFiles files={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders a FileChip for each file', () => {
    render(<MessageFiles files={files} />);
    expect(screen.getByTestId('chip-doc.pdf')).toBeInTheDocument();
    expect(screen.getByTestId('chip-photo.png')).toBeInTheDocument();
  });

  it('opens preview modal when a chip is clicked', async () => {
    const user = userEvent.setup();
    render(<MessageFiles files={files} />);

    expect(screen.queryByTestId('preview-modal')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('chip-doc.pdf'));

    expect(screen.getByTestId('preview-modal')).toHaveTextContent('doc.pdf');
  });

  it('closes preview modal via onOpenChange(false)', async () => {
    const user = userEvent.setup();
    render(<MessageFiles files={files} />);

    // Open the modal
    await user.click(screen.getByTestId('chip-doc.pdf'));
    expect(screen.getByTestId('preview-modal')).toBeInTheDocument();

    // Close it via the close button in the mock
    await user.click(screen.getByTestId('close-modal'));
    expect(screen.queryByTestId('preview-modal')).not.toBeInTheDocument();
  });
});
