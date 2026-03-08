import type * as React from 'react';

const Table = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', ...style }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>{children}</table>
  </div>
);

const TableHeader = ({ children }: { children: React.ReactNode }) => (
  <thead>
    <tr style={{ background: 'var(--surface-card)', borderBottom: '1px solid var(--border)' }}>{children}</tr>
  </thead>
);

const TableHead = ({ children }: { children: React.ReactNode }) => (
  <th
    style={{
      padding: '8px 14px',
      textAlign: 'left',
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--text-tertiary)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
    }}
  >
    {children}
  </th>
);

const TableBody = ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>;

type TableRowProps = {
  children: React.ReactNode;
  isLast?: boolean;
};

const TableRow = ({ children, isLast = false }: TableRowProps) => (
  <tr
    style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'var(--surface-hover)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent';
    }}
  >
    {children}
  </tr>
);

type TableCellProps = {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'mono';
};

const TableCell = ({ children, variant = 'secondary' }: TableCellProps) => (
  <td
    style={{
      padding: '9px 14px',
      color: variant === 'primary' ? 'var(--text-primary)' : 'var(--text-secondary)',
      fontWeight: variant === 'primary' ? 500 : undefined,
      fontFamily: variant === 'mono' ? 'var(--font-mono)' : undefined,
      fontSize: variant === 'mono' ? 11 : undefined,
    }}
  >
    {children}
  </td>
);

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
