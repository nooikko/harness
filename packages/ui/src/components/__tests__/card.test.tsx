import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../card';

describe('Card', () => {
  it('renders a card with content', () => {
    render(
      <Card data-testid='card'>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Content</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );

    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('merges custom className on Card', () => {
    render(
      <Card data-testid='card' className='custom-class'>
        Test
      </Card>,
    );
    expect(screen.getByTestId('card').className).toContain('custom-class');
  });

  it('applies data-slot attributes', () => {
    render(
      <Card data-testid='card'>
        <CardHeader data-testid='header' />
      </Card>,
    );
    expect(screen.getByTestId('card')).toHaveAttribute('data-slot', 'card');
    expect(screen.getByTestId('header')).toHaveAttribute('data-slot', 'card-header');
  });
});
