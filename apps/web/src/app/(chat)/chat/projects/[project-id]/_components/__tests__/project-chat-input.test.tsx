import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@harness/database', () => ({}));

const mockCreateThread = vi.fn().mockResolvedValue({ threadId: 't-1' });
const mockSendMessage = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../../_actions/create-thread', () => ({
  createThread: (...args: unknown[]) => mockCreateThread(...args),
}));

vi.mock('../../../../_actions/send-message', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

vi.mock('../../../_actions/create-thread', () => ({
  createThread: (...args: unknown[]) => mockCreateThread(...args),
}));

vi.mock('../../../_actions/send-message', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

import { ProjectChatInput } from '../project-chat-input';

describe('ProjectChatInput', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockCreateThread.mockClear();
    mockSendMessage.mockClear();
  });

  it('renders the textarea and submit button', () => {
    render(<ProjectChatInput projectId='proj-1' />);
    expect(screen.getByPlaceholderText(/start a new chat/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('disables submit button when input is empty', () => {
    render(<ProjectChatInput projectId='proj-1' />);
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('does not submit when content is only whitespace', () => {
    render(<ProjectChatInput projectId='proj-1' />);
    const textarea = screen.getByPlaceholderText(/start a new chat/i);
    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.submit(textarea.closest('form')!);
    expect(mockCreateThread).not.toHaveBeenCalled();
  });

  it('creates thread, sends message, and navigates on submit', async () => {
    render(<ProjectChatInput projectId='proj-1' />);
    const textarea = screen.getByPlaceholderText(/start a new chat/i);
    fireEvent.change(textarea, { target: { value: 'Hello world' } });
    fireEvent.submit(textarea.closest('form')!);
    await waitFor(() => {
      expect(mockCreateThread).toHaveBeenCalledWith({ projectId: 'proj-1' });
      expect(mockSendMessage).toHaveBeenCalledWith('t-1', 'Hello world');
      expect(mockPush).toHaveBeenCalledWith('/chat/t-1');
    });
  });

  it('submit button remains disabled when input is only whitespace', () => {
    render(<ProjectChatInput projectId='proj-1' />);
    const textarea = screen.getByPlaceholderText(/start a new chat/i);
    fireEvent.change(textarea, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('submits on Enter key without Shift', async () => {
    render(<ProjectChatInput projectId='proj-1' />);
    const textarea = screen.getByPlaceholderText(/start a new chat/i);
    fireEvent.change(textarea, { target: { value: 'Enter submit' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    await waitFor(() => {
      expect(mockCreateThread).toHaveBeenCalledWith({ projectId: 'proj-1' });
      expect(mockSendMessage).toHaveBeenCalledWith('t-1', 'Enter submit');
    });
  });

  it('does not submit on Shift+Enter', () => {
    render(<ProjectChatInput projectId='proj-1' />);
    const textarea = screen.getByPlaceholderText(/start a new chat/i);
    fireEvent.change(textarea, { target: { value: 'multiline' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(mockCreateThread).not.toHaveBeenCalled();
  });

  it('does not submit on Enter when input is empty', () => {
    render(<ProjectChatInput projectId='proj-1' />);
    const textarea = screen.getByPlaceholderText(/start a new chat/i);
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(mockCreateThread).not.toHaveBeenCalled();
  });

  it('trims content before sending', async () => {
    render(<ProjectChatInput projectId='proj-1' />);
    const textarea = screen.getByPlaceholderText(/start a new chat/i);
    fireEvent.change(textarea, { target: { value: '  trimmed  ' } });
    fireEvent.submit(textarea.closest('form')!);
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('t-1', 'trimmed');
    });
  });
});
