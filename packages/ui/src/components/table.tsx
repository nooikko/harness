'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '../index';

const Table = ({ className, ...props }: React.ComponentProps<'table'>) => (
  <div data-slot='table-container' className={cn('relative w-full overflow-x-auto rounded-lg border border-border', className)}>
    <table data-slot='table' className='w-full min-w-full caption-bottom text-xs' {...props} />
  </div>
);

const TableHeader = ({ className, ...props }: React.ComponentProps<'thead'>) => (
  <thead data-slot='table-header' className={cn('bg-card [&_tr]:border-b [&_tr]:border-border', className)} {...props} />
);

const TableBody = ({ className, ...props }: React.ComponentProps<'tbody'>) => (
  <tbody data-slot='table-body' className={cn('[&_tr:last-child]:border-0', className)} {...props} />
);

const TableFooter = ({ className, ...props }: React.ComponentProps<'tfoot'>) => (
  <tfoot data-slot='table-footer' className={cn('bg-muted/50 border-t border-border font-medium [&>tr]:last:border-b-0', className)} {...props} />
);

const TableRow = ({ className, ...props }: React.ComponentProps<'tr'>) => (
  <tr
    data-slot='table-row'
    className={cn('border-b border-border/50 transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', className)}
    {...props}
  />
);

const TableHead = ({ className, ...props }: React.ComponentProps<'th'>) => (
  <th
    data-slot='table-head'
    className={cn(
      'px-3.5 py-2 text-left align-middle text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground whitespace-nowrap',
      '[&:has([role=checkbox])]:pr-0',
      className,
    )}
    {...props}
  />
);

const tableCellVariants = cva('px-3.5 py-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0', {
  variants: {
    variant: {
      primary: 'text-foreground font-medium',
      secondary: 'text-muted-foreground',
      mono: 'font-mono text-[11px] text-muted-foreground',
    },
  },
  defaultVariants: {
    variant: 'secondary',
  },
});

type TableCellProps = React.ComponentProps<'td'> & VariantProps<typeof tableCellVariants>;

const TableCell = ({ className, variant, ...props }: TableCellProps) => (
  <td data-slot='table-cell' className={cn(tableCellVariants({ variant }), className)} {...props} />
);

const TableCaption = ({ className, ...props }: React.ComponentProps<'caption'>) => (
  <caption data-slot='table-caption' className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
);

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
export type { TableCellProps };
