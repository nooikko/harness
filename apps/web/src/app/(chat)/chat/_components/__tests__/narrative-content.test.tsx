import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NarrativeContent } from '../narrative-content';

describe('NarrativeContent', () => {
  it('renders **SAM**: "hello" with colored left border and speaker badge', () => {
    render(<NarrativeContent content={'**SAM**: "hello"'} />);
    expect(screen.getByText('SAM')).toBeInTheDocument();
    expect(screen.getByText('SAM').tagName).toBe('SPAN');
  });

  it('speaker badge has inline color style set', () => {
    render(<NarrativeContent content={'**SAM**: "hello"'} />);
    const badge = screen.getByText('SAM');
    // JSDOM normalizes hex to rgb — just verify inline style is present
    expect(badge.style.color).toBeTruthy();
  });

  it('renders **SAM** *(hesitant)*: "hello" with emotion tag', () => {
    render(<NarrativeContent content={'**SAM** *(hesitant)*: "hello"'} />);
    expect(screen.getByText('SAM')).toBeInTheDocument();
    expect(screen.getByText('(hesitant)')).toBeInTheDocument();
  });

  it('renders *She paused.* with muted styling (em component)', () => {
    render(<NarrativeContent content='*She paused.*' />);
    const em = screen.getByText('She paused.');
    expect(em.tagName).toBe('EM');
    expect(em.className).toContain('italic');
  });

  it('renders > blockquote with thought-bubble styling', () => {
    render(<NarrativeContent content="> I can't do this" />);
    expect(screen.getByText("I can't do this")).toBeInTheDocument();
    // Should be in a div with thought-bubble classes, not a <blockquote>
    const container = screen.getByText("I can't do this").closest('div.italic');
    expect(container).not.toBeNull();
  });

  it('renders --- as decorative scene break with separator role', () => {
    render(<NarrativeContent content={'Some text\n\n---\n\nMore text'} />);
    const separator = document.querySelector('[aria-hidden="true"]');
    expect(separator).not.toBeNull();
  });

  it('renders plain paragraph as standard prose', () => {
    render(<NarrativeContent content='Just a normal paragraph.' />);
    const p = screen.getByText('Just a normal paragraph.');
    expect(p.tagName).toBe('P');
  });

  it('renders full mixed response in correct order', () => {
    const content = [
      '**SAM**: "Hello there."',
      '',
      '*She walked to the window.*',
      '',
      '> I wonder what happens next.',
      '',
      '---',
      '',
      'The sun set over the hills.',
    ].join('\n');

    const { container } = render(<NarrativeContent content={content} />);
    expect(screen.getByText('SAM')).toBeInTheDocument();
    expect(screen.getByText('She walked to the window.')).toBeInTheDocument();
    expect(screen.getByText('I wonder what happens next.')).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByText('The sun set over the hills.')).toBeInTheDocument();
  });

  it('renders content with no narrative patterns like standard markdown', () => {
    render(<NarrativeContent content='A regular **bold** and *italic* paragraph.' />);
    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getByText('italic').tagName).toBe('EM');
  });

  it('preserves links within content', () => {
    render(<NarrativeContent content='Check [this link](https://example.com).' />);
    const link = screen.getByRole('link', { name: 'this link' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders inline code without language class as inline code', () => {
    render(<NarrativeContent content='Use `const x = 1` here.' />);
    const code = screen.getByText('const x = 1');
    expect(code.tagName).toBe('CODE');
    expect(code.className).toContain('rounded');
  });

  it('renders fenced code blocks with language class', () => {
    const { container } = render(<NarrativeContent content={'```js\nconsole.log("hi")\n```'} />);
    // CodeBlock renders with syntax highlighting — check for the code container
    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
  });

  it('renders dialogue without emotion tag when no stage direction present', () => {
    render(<NarrativeContent content={'**ELENA**: "I understand."'} />);
    expect(screen.getByText('ELENA')).toBeInTheDocument();
    // No emotion tag should be present
    const emotionSpan = document.querySelector('.text-xs.italic');
    expect(emotionSpan).toBeNull();
  });

  it('renders pre tag children directly without pre wrapper', () => {
    const { container } = render(<NarrativeContent content={'```\nplain code\n```'} />);
    // Custom pre component strips the <pre> wrapper — children render directly
    const pre = container.querySelector('pre');
    expect(pre).toBeNull();
    expect(screen.getByText('plain code')).toBeInTheDocument();
  });
});
