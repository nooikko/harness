import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../tabs';

describe('Tabs', () => {
  const renderTabs = () =>
    render(
      <Tabs defaultValue='a' data-testid='tabs'>
        <TabsList data-testid='list'>
          <TabsTrigger value='a' data-testid='trigger-a'>
            Tab A
          </TabsTrigger>
          <TabsTrigger value='b' data-testid='trigger-b'>
            Tab B
          </TabsTrigger>
        </TabsList>
        <TabsContent value='a' data-testid='content-a'>
          Content A
        </TabsContent>
        <TabsContent value='b' data-testid='content-b'>
          Content B
        </TabsContent>
      </Tabs>,
    );

  it('renders with data-slot attributes', () => {
    renderTabs();
    expect(screen.getByTestId('tabs')).toHaveAttribute('data-slot', 'tabs');
    expect(screen.getByTestId('list')).toHaveAttribute('data-slot', 'tabs-list');
    expect(screen.getByTestId('trigger-a')).toHaveAttribute('data-slot', 'tabs-trigger');
    expect(screen.getByTestId('content-a')).toHaveAttribute('data-slot', 'tabs-content');
  });

  it('shows first tab content by default', () => {
    renderTabs();
    expect(screen.getByText('Content A')).toBeTruthy();
  });

  it('renders trigger-b as inactive initially', () => {
    renderTabs();
    expect(screen.getByTestId('trigger-b')).toHaveAttribute('data-state', 'inactive');
  });

  it('marks active trigger', () => {
    renderTabs();
    expect(screen.getByTestId('trigger-a')).toHaveAttribute('data-state', 'active');
    expect(screen.getByTestId('trigger-b')).toHaveAttribute('data-state', 'inactive');
  });

  it('merges custom className on Tabs', () => {
    render(
      <Tabs defaultValue='a' data-testid='t' className='my-tabs'>
        <TabsList>
          <TabsTrigger value='a'>A</TabsTrigger>
        </TabsList>
        <TabsContent value='a'>C</TabsContent>
      </Tabs>,
    );
    expect(screen.getByTestId('t').className).toContain('my-tabs');
  });

  it('merges custom className on TabsList', () => {
    render(
      <Tabs defaultValue='a'>
        <TabsList data-testid='list' className='custom-list'>
          <TabsTrigger value='a'>A</TabsTrigger>
        </TabsList>
        <TabsContent value='a'>C</TabsContent>
      </Tabs>,
    );
    expect(screen.getByTestId('list').className).toContain('custom-list');
  });

  it('merges custom className on TabsContent', () => {
    renderTabs();
    expect(screen.getByTestId('content-a').className).toContain('flex-1');
  });
});
