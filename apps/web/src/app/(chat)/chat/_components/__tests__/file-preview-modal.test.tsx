import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FilePreviewModal } from '../file-preview-modal';

// Mock the CodeBlock component
vi.mock('../code-block', () => ({
  CodeBlock: ({ children }: { children: string }) => <pre data-testid='code-block'>{children}</pre>,
}));

// Mock Dialog components from @harness/ui
vi.mock('@harness/ui', () => ({
  Button: ({ children, ...props }: React.ComponentPropsWithoutRef<'button'> & { asChild?: boolean }) => {
    if (props.asChild) {
      return <>{children}</>;
    }
    return <button {...props}>{children}</button>;
  },
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean; onOpenChange: (v: boolean) => void }) =>
    open ? <div data-testid='dialog'>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const imageFile = { id: 'f1', name: 'photo.png', mimeType: 'image/png', size: 1024 };
const pdfFile = { id: 'f2', name: 'doc.pdf', mimeType: 'application/pdf', size: 2048 };
const textFile = { id: 'f3', name: 'readme.md', mimeType: 'text/markdown', size: 512 };
const jsonFile = { id: 'f4', name: 'data.json', mimeType: 'application/json', size: 256 };
const jsFile = { id: 'f5', name: 'index.js', mimeType: 'application/javascript', size: 128 };
const xmlFile = { id: 'f6', name: 'config.xml', mimeType: 'application/xml', size: 64 };
const binaryFile = { id: 'f7', name: 'archive.zip', mimeType: 'application/zip', size: 4096 };

describe('FilePreviewModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when file is null', () => {
    const { container } = render(<FilePreviewModal file={null} open={true} onOpenChange={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when open is false', () => {
    const { container } = render(<FilePreviewModal file={imageFile} open={false} onOpenChange={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders image preview for image MIME types', () => {
    render(<FilePreviewModal file={imageFile} open={true} onOpenChange={vi.fn()} />);
    const img = screen.getByAltText('photo.png');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/api/files/f1');
  });

  it('renders PDF preview with sandboxed iframe', () => {
    render(<FilePreviewModal file={pdfFile} open={true} onOpenChange={vi.fn()} />);
    const iframe = screen.getByTitle('doc.pdf');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', '/api/files/f2');
    expect(iframe).toHaveAttribute('sandbox', 'allow-same-origin');
  });

  it('renders text preview for text/ MIME types', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('# Hello World'),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<FilePreviewModal file={textFile} open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('code-block')).toHaveTextContent('# Hello World');
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/files/f3', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('renders text preview for application/json', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('{"key":"val"}') }));

    render(<FilePreviewModal file={jsonFile} open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('code-block')).toHaveTextContent('{"key":"val"}');
    });
  });

  it('renders text preview for application/javascript', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('console.log("hi")') }));

    render(<FilePreviewModal file={jsFile} open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('code-block')).toHaveTextContent('console.log("hi")');
    });
  });

  it('renders text preview for application/xml', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('<root/>') }));

    render(<FilePreviewModal file={xmlFile} open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('code-block')).toHaveTextContent('<root/>');
    });
  });

  it('renders download fallback for unknown MIME types', () => {
    render(<FilePreviewModal file={binaryFile} open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText(/Preview not available/)).toBeInTheDocument();
    const link = screen.getByText(/Download archive.zip/);
    expect(link.closest('a')).toHaveAttribute('href', '/api/files/f7');
  });

  it('shows loading state before content is fetched', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
    );

    render(<FilePreviewModal file={textFile} open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    render(<FilePreviewModal file={textFile} open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load file content/)).toBeInTheDocument();
    });
  });

  it('renders file name in the header', () => {
    render(<FilePreviewModal file={imageFile} open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('photo.png')).toBeInTheDocument();
  });

  it('renders download link in header', () => {
    render(<FilePreviewModal file={imageFile} open={true} onOpenChange={vi.fn()} />);
    const links = screen.getAllByRole('link');
    const downloadLink = links.find((l) => l.getAttribute('href') === '/api/files/f1');
    expect(downloadLink).toBeInTheDocument();
  });

  it('maps file extensions to languages correctly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('const x = 1') }));

    const tsFile = { id: 'f8', name: 'app.ts', mimeType: 'text/plain', size: 32 };
    render(<FilePreviewModal file={tsFile} open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('code-block')).toBeInTheDocument();
    });
  });
});
