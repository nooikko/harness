import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Alert, AlertDescription, AlertTitle } from '../alert';

describe('Alert', () => {
  it('renders with default variant', () => {
    render(
      <Alert data-testid='alert'>
        <AlertTitle>Heads up!</AlertTitle>
        <AlertDescription>Description text</AlertDescription>
      </Alert>,
    );

    const alert = screen.getByTestId('alert');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(screen.getByText('Heads up!')).toBeInTheDocument();
    expect(screen.getByText('Description text')).toBeInTheDocument();
  });

  it('renders destructive variant', () => {
    render(
      <Alert data-testid='alert' variant='destructive'>
        Error
      </Alert>,
    );
    expect(screen.getByTestId('alert').className).toContain('text-destructive');
  });

  it('merges custom className', () => {
    render(
      <Alert data-testid='alert' className='my-class'>
        Test
      </Alert>,
    );
    expect(screen.getByTestId('alert').className).toContain('my-class');
  });
});
