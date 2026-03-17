import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDeleteThread = vi.fn();
vi.mock('../../_actions/delete-thread', () => ({
  deleteThread: (...args: unknown[]) => mockDeleteThread(...args),
}));

const mockRequestAuditDelete = vi.fn();
vi.mock('../../_actions/request-audit-delete', () => ({
  requestAuditDelete: (...args: unknown[]) => mockRequestAuditDelete(...args),
}));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { DeleteThreadModal } from '../delete-thread-modal';

describe('DeleteThreadModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteThread.mockResolvedValue(undefined);
    mockRequestAuditDelete.mockResolvedValue({ ok: true });
  });

  it('does not render when closed', () => {
    const { container } = render(<DeleteThreadModal open={false} onOpenChange={vi.fn()} threadId='t-1' threadName='My Chat' />);
    expect(container.textContent).toBe('');
  });

  it('renders with thread name when open', () => {
    render(<DeleteThreadModal open={true} onOpenChange={vi.fn()} threadId='t-1' threadName='My Chat' />);
    expect(screen.getByText(/delete chat/i)).toBeInTheDocument();
    expect(screen.getByText(/My Chat/)).toBeInTheDocument();
  });

  it('uses "this chat" as fallback when threadName is null', () => {
    render(<DeleteThreadModal open={true} onOpenChange={vi.fn()} threadId='t-1' threadName={null} />);
    expect(screen.getByText(/this chat/i)).toBeInTheDocument();
  });

  it('calls requestAuditDelete and closes when Audit & Delete is clicked', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<DeleteThreadModal open={true} onOpenChange={onOpenChange} threadId='t-1' threadName='Chat' />);

    await user.click(screen.getByRole('button', { name: /audit.*delete/i }));

    expect(mockRequestAuditDelete).toHaveBeenCalledWith('t-1');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls deleteThread and navigates when Delete without audit is selected', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<DeleteThreadModal open={true} onOpenChange={onOpenChange} threadId='t-1' threadName='Chat' />);

    // Open the dropdown for more options
    await user.click(screen.getByRole('button', { name: /more delete options/i }));
    await user.click(await screen.findByText(/delete without audit/i));

    expect(mockDeleteThread).toHaveBeenCalledWith('t-1');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('calls onDeleted callback after delete without audit', async () => {
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(<DeleteThreadModal open={true} onOpenChange={vi.fn()} threadId='t-1' threadName='Chat' onDeleted={onDeleted} />);

    await user.click(screen.getByRole('button', { name: /more delete options/i }));
    await user.click(await screen.findByText(/delete without audit/i));

    expect(onDeleted).toHaveBeenCalled();
  });

  it('closes when Cancel is clicked', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<DeleteThreadModal open={true} onOpenChange={onOpenChange} threadId='t-1' threadName='Chat' />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
