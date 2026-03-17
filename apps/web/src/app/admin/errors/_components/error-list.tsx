'use client';

// Client component — renders error log entries as a table with expandable detail modal

import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@harness/ui';
import { AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { ErrorDetailModal } from './error-detail-modal';

type SerializedError = {
  id: string;
  level: string;
  source: string;
  message: string;
  stack: string | null;
  traceId: string | null;
  threadId: string | null;
  metadata: unknown;
  createdAt: string;
};

type ErrorListProps = {
  errors: SerializedError[];
};

type ErrorListComponent = (props: ErrorListProps) => React.ReactNode;

type LevelVariant = 'destructive' | 'warning';

const levelVariant = (level: string): LevelVariant => (level === 'error' ? 'destructive' : 'warning');

type FormatRelative = (date: Date) => string;

const formatRelative: FormatRelative = (date) => {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) {
    return 'just now';
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

type TruncateMessage = (message: string, maxLength?: number) => string;

const truncateMessage: TruncateMessage = (message, maxLength = 80) => {
  const firstLine = message.split('\n')[0] ?? message;
  if (firstLine.length <= maxLength) {
    return firstLine;
  }
  return `${firstLine.slice(0, maxLength)}...`;
};

export const ErrorList: ErrorListComponent = ({ errors }) => {
  const [selectedError, setSelectedError] = useState<SerializedError | null>(null);

  if (errors.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center gap-3 py-20 text-center'>
        <AlertCircle className='h-8 w-8 text-muted-foreground/30' />
        <div className='flex flex-col gap-1'>
          <p className='text-sm text-muted-foreground'>No errors found</p>
          <p className='text-xs text-muted-foreground/60'>Errors will appear here when they are logged.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {errors.map((error) => (
            <TableRow key={error.id} className='cursor-pointer hover:bg-muted/50' onClick={() => setSelectedError(error)}>
              <TableCell className='whitespace-nowrap text-muted-foreground'>{formatRelative(new Date(error.createdAt))}</TableCell>
              <TableCell>
                <Badge variant={levelVariant(error.level)}>{error.level}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant='outline'>{error.source}</Badge>
              </TableCell>
              <TableCell variant='primary' className='max-w-md truncate font-mono text-xs'>
                {truncateMessage(error.message)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ErrorDetailModal
        error={selectedError}
        open={selectedError !== null}
        onOpenChangeAction={(open: boolean) => {
          if (!open) {
            setSelectedError(null);
          }
        }}
      />
    </>
  );
};
