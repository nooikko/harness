import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListThreadFiles = vi.fn();
const mockDeleteFile = vi.fn();

vi.mock('../../_actions/list-thread-files', () => ({
  listThreadFiles: (...args: unknown[]) => mockListThreadFiles(...args),
}));

vi.mock('../../_actions/delete-file', () => ({
  deleteFile: (...args: unknown[]) => mockDeleteFile(...args),
}));

vi.mock('../file-chip', () => ({
  FileChip: ({ file, onClick }: { file: { name: string }; onClick?: () => void }) => (
    <button type='button' data-testid={`chip-${file.name}`} onClick={onClick}>
      {file.name}
    </button>
  ),
}));

vi.mock('../file-preview-modal', () => ({
  FilePreviewModal: ({ file, open }: { file: { name: string } | null; open: boolean }) =>
    open && file ? <div data-testid='preview-modal'>{file.name}</div> : null,
}));

vi.mock('@harness/ui', () => ({
  Button: ({ children, ...props }: React.ComponentPropsWithoutRef<'button'>) => <button {...props}>{children}</button>,
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { ThreadAttachmentsPanel } from '../thread-attachments-panel';

const imageFile = {
  id: 'f1',
  name: 'photo.png',
  mimeType: 'image/png',
  size: 1024,
  path: 'threads/t1/photo.png',
  scope: 'THREAD' as const,
  projectId: null,
  threadId: 't1',
  agentId: null,
  messageId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const docFile = {
  ...imageFile,
  id: 'f2',
  name: 'readme.md',
  mimeType: 'text/markdown',
  path: 'threads/t1/readme.md',
};

describe('ThreadAttachmentsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListThreadFiles.mockResolvedValue([]);
  });

  it('returns null when not open', () => {
    const { container } = render(<ThreadAttachmentsPanel threadId='t1' open={false} onOpenChange={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('loads files when opened', async () => {
    mockListThreadFiles.mockResolvedValue([imageFile]);

    await act(async () => {
      render(<ThreadAttachmentsPanel threadId='t1' open={true} onOpenChange={vi.fn()} />);
    });

    expect(mockListThreadFiles).toHaveBeenCalledWith('t1');
    expect(screen.getByText('Attachments (1)')).toBeInTheDocument();
  });

  it('shows empty state when no files', async () => {
    await act(async () => {
      render(<ThreadAttachmentsPanel threadId='t1' open={true} onOpenChange={vi.fn()} />);
    });

    expect(screen.getByText('No files attached to this thread.')).toBeInTheDocument();
  });

  it('shows load error', async () => {
    mockListThreadFiles.mockRejectedValue(new Error('Network error'));

    await act(async () => {
      render(<ThreadAttachmentsPanel threadId='t1' open={true} onOpenChange={vi.fn()} />);
    });

    expect(screen.getByText('Failed to load attachments.')).toBeInTheDocument();
  });

  it('groups files into images and documents', async () => {
    mockListThreadFiles.mockResolvedValue([imageFile, docFile]);

    await act(async () => {
      render(<ThreadAttachmentsPanel threadId='t1' open={true} onOpenChange={vi.fn()} />);
    });

    expect(screen.getByText('Images')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
  });

  it('calls onOpenChange when close button is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    await act(async () => {
      render(<ThreadAttachmentsPanel threadId='t1' open={true} onOpenChange={onOpenChange} />);
    });

    await user.click(screen.getByLabelText('Close attachments'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('deletes a file and removes it from the list', async () => {
    mockListThreadFiles.mockResolvedValue([imageFile, docFile]);
    mockDeleteFile.mockResolvedValue({});
    const user = userEvent.setup();

    await act(async () => {
      render(<ThreadAttachmentsPanel threadId='t1' open={true} onOpenChange={vi.fn()} />);
    });

    expect(screen.getByText('Attachments (2)')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Delete photo.png'));

    expect(mockDeleteFile).toHaveBeenCalledWith('f1');
    expect(screen.getByText('Attachments (1)')).toBeInTheDocument();
  });

  it('reloads files when delete fails', async () => {
    mockListThreadFiles.mockResolvedValue([imageFile]);
    mockDeleteFile.mockRejectedValue(new Error('Failed'));
    const user = userEvent.setup();

    await act(async () => {
      render(<ThreadAttachmentsPanel threadId='t1' open={true} onOpenChange={vi.fn()} />);
    });

    mockListThreadFiles.mockResolvedValue([imageFile]);

    await act(async () => {
      await user.click(screen.getByLabelText('Delete photo.png'));
    });

    // Should have called listThreadFiles again (initial load + reload)
    expect(mockListThreadFiles).toHaveBeenCalledTimes(2);
  });

  it('opens preview when file chip is clicked', async () => {
    mockListThreadFiles.mockResolvedValue([docFile]);
    const user = userEvent.setup();

    await act(async () => {
      render(<ThreadAttachmentsPanel threadId='t1' open={true} onOpenChange={vi.fn()} />);
    });

    await user.click(screen.getByTestId('chip-readme.md'));
    expect(screen.getByTestId('preview-modal')).toHaveTextContent('readme.md');
  });
});
