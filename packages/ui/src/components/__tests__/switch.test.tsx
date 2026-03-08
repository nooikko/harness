import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from '../switch';

describe('Switch', () => {
  it('renders with switch role', () => {
    render(<Switch checked={false} onCheckedChange={() => {}} data-testid='sw' />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('renders unchecked by default', () => {
    render(<Switch checked={false} onCheckedChange={() => {}} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('renders checked when checked=true', () => {
    render(<Switch checked={true} onCheckedChange={() => {}} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onCheckedChange on click', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('merges custom className', () => {
    render(<Switch checked={false} onCheckedChange={() => {}} className='my-custom' />);
    expect(screen.getByRole('switch').className).toContain('my-custom');
  });

  it('renders thumb element', () => {
    const { container } = render(<Switch checked={false} onCheckedChange={() => {}} />);
    const thumb = container.querySelector('div > div');
    expect(thumb).toBeTruthy();
  });

  it('supports disabled state', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onChange} disabled />);
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(sw);
    expect(onChange).not.toHaveBeenCalled();
  });
});
