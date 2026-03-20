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

vi.mock('../inline-media-gallery', () => ({
  InlineMediaGallery: ({ images, videos }: { images: { name: string }[]; videos: { name: string }[] }) => (
    <div data-testid='media-gallery'>
      {images.map((f) => (
        <img key={f.name} data-testid={`inline-${f.name}`} alt={f.name} />
      ))}
      {videos.map((f) => (
        <video key={f.name} data-testid={`inline-${f.name}`}>
          <track kind='captions' />
        </video>
      ))}
    </div>
  ),
}));

import { MessageFiles } from '../message-files';

const files = [
  { id: 'f1', name: 'doc.pdf', mimeType: 'application/pdf', size: 1024 },
  { id: 'f2', name: 'photo.png', mimeType: 'image/png', size: 2048 },
  { id: 'f3', name: 'clip.webm', mimeType: 'video/webm', size: 4096 },
];

describe('MessageFiles', () => {
  it('returns null when files array is empty', () => {
    const { container } = render(<MessageFiles files={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders media files inline and non-media as chips', () => {
    render(<MessageFiles files={files} />);
    // Image rendered inline, not as chip
    expect(screen.getByTestId('inline-photo.png')).toBeInTheDocument();
    expect(screen.queryByTestId('chip-photo.png')).not.toBeInTheDocument();
    // Video rendered inline, not as chip
    expect(screen.getByTestId('inline-clip.webm')).toBeInTheDocument();
    expect(screen.queryByTestId('chip-clip.webm')).not.toBeInTheDocument();
    // PDF still rendered as chip
    expect(screen.getByTestId('chip-doc.pdf')).toBeInTheDocument();
  });

  it('opens preview modal when a non-media chip is clicked', async () => {
    const user = userEvent.setup();
    render(<MessageFiles files={files} />);

    expect(screen.queryByTestId('preview-modal')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('chip-doc.pdf'));
    expect(screen.getByTestId('preview-modal')).toHaveTextContent('doc.pdf');
  });

  it('closes preview modal via onOpenChange(false)', async () => {
    const user = userEvent.setup();
    render(<MessageFiles files={files} />);

    await user.click(screen.getByTestId('chip-doc.pdf'));
    expect(screen.getByTestId('preview-modal')).toBeInTheDocument();

    await user.click(screen.getByTestId('close-modal'));
    expect(screen.queryByTestId('preview-modal')).not.toBeInTheDocument();
  });

  it('renders only media gallery when all files are images/videos', () => {
    const mediaOnly = [
      { id: 'f1', name: 'a.png', mimeType: 'image/png', size: 100 },
      { id: 'f2', name: 'b.webm', mimeType: 'video/webm', size: 200 },
    ];
    render(<MessageFiles files={mediaOnly} />);
    expect(screen.getByTestId('media-gallery')).toBeInTheDocument();
    // No chip container rendered
    expect(screen.queryByTestId('chip-a.png')).not.toBeInTheDocument();
  });
});
