import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from '../markdown-content';

describe('MarkdownContent', () => {
  it('renders bold text as <strong>', () => {
    render(<MarkdownContent content='This is **bold** text' />);
    const strong = screen.getByText('bold');
    expect(strong.tagName).toBe('STRONG');
  });

  it('renders italic text as <em>', () => {
    render(<MarkdownContent content='This is *italic* text' />);
    const em = screen.getByText('italic');
    expect(em.tagName).toBe('EM');
  });

  it('renders inline code with code element', () => {
    render(<MarkdownContent content='Use `console.log` here' />);
    const code = screen.getByText('console.log');
    expect(code.tagName).toBe('CODE');
  });

  it('renders a fenced code block with pre and code elements', () => {
    render(<MarkdownContent content={'```js\nconst x = 1;\n```'} />);
    const codeBlock = screen.getByText('const x = 1;');
    expect(codeBlock.closest('pre')).not.toBeNull();
  });

  it('renders an unordered list', () => {
    const listContent = '- item one\n- item two';
    render(<MarkdownContent content={listContent} />);
    expect(screen.getByText('item one')).toBeInTheDocument();
    expect(screen.getByText('item two')).toBeInTheDocument();
    const listItems = document.querySelectorAll('li');
    expect(listItems.length).toBe(2);
  });

  it('renders links with anchor elements', () => {
    render(<MarkdownContent content='Visit [example](https://example.com)' />);
    const link = screen.getByRole('link', { name: 'example' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders GFM tables', () => {
    const md = '| Name | Age |\n|------|-----|\n| Alice | 30 |';
    render(<MarkdownContent content={md} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(document.querySelector('table')).not.toBeNull();
  });

  it('renders GFM strikethrough', () => {
    render(<MarkdownContent content='This is ~~deleted~~ text' />);
    const del = screen.getByText('deleted');
    expect(del.tagName).toBe('DEL');
  });

  it('renders blockquotes', () => {
    render(<MarkdownContent content='> This is a quote' />);
    expect(document.querySelector('blockquote')).not.toBeNull();
    expect(screen.getByText('This is a quote')).toBeInTheDocument();
  });

  it('applies prose class to wrapper', () => {
    const { container } = render(<MarkdownContent content='Hello' />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.classList.contains('prose')).toBe(true);
  });

  it('renders plain text without crashing', () => {
    render(<MarkdownContent content='Just plain text' />);
    expect(screen.getByText('Just plain text')).toBeInTheDocument();
  });
});
