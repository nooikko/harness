import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FileChip } from '../file-chip';

const baseFile = { id: 'f1', name: 'photo.png', mimeType: 'image/png', size: 2048 };

describe('FileChip', () => {
  it('renders the file name and size', () => {
    render(<FileChip file={baseFile} />);
    expect(screen.getByText('photo.png')).toBeInTheDocument();
    expect(screen.getByText('2KB')).toBeInTheDocument();
  });

  it('formats bytes correctly', () => {
    render(<FileChip file={{ ...baseFile, size: 500 }} />);
    expect(screen.getByText('500B')).toBeInTheDocument();
  });

  it('formats megabytes correctly', () => {
    render(<FileChip file={{ ...baseFile, size: 5 * 1024 * 1024 }} />);
    expect(screen.getByText('5.0MB')).toBeInTheDocument();
  });

  it('renders as a span when no onClick is provided', () => {
    const { container } = render(<FileChip file={baseFile} />);
    expect(container.querySelector('span.inline-flex')).toBeInTheDocument();
    expect(container.querySelector('button.inline-flex')).not.toBeInTheDocument();
  });

  it('renders as a button when onClick is provided', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<FileChip file={baseFile} onClick={onClick} />);
    const btn = screen.getAllByRole('button').find((b) => b.classList.contains('inline-flex'))!;
    await user.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders remove button when onRemove is provided', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<FileChip file={baseFile} onRemove={onRemove} />);
    const removeBtn = screen.getByLabelText('Remove photo.png');
    await user.click(removeBtn);
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('does not render remove button when onRemove is not provided', () => {
    render(<FileChip file={baseFile} />);
    expect(screen.queryByLabelText(/Remove/)).not.toBeInTheDocument();
  });

  it('shows PDF icon for application/pdf', () => {
    const { container } = render(<FileChip file={{ ...baseFile, mimeType: 'application/pdf' }} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('shows code icon for text/ and application/json', () => {
    const { container: c1 } = render(<FileChip file={{ ...baseFile, mimeType: 'text/plain' }} />);
    expect(c1.querySelector('svg')).toBeInTheDocument();

    const { container: c2 } = render(<FileChip file={{ ...baseFile, mimeType: 'application/json' }} />);
    expect(c2.querySelector('svg')).toBeInTheDocument();
  });

  it('shows generic file icon for unknown MIME types', () => {
    const { container } = render(<FileChip file={{ ...baseFile, mimeType: 'application/octet-stream' }} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
