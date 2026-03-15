'use client';

import { Badge } from '@harness/ui';
import { X } from 'lucide-react';
import type React from 'react';

type Filters = {
  agent?: string;
  project?: string;
  thread?: string;
  role?: 'user' | 'assistant';
  hasFile?: boolean;
  fileName?: string;
  before?: Date;
  after?: Date;
};

type SearchFilterChipsProps = {
  filters: Filters;
  onRemoveFilter: (filterKey: string) => void;
};

type FilterEntry = {
  key: string;
  label: string;
};

type BuildEntries = (filters: Filters) => FilterEntry[];

const buildEntries: BuildEntries = (filters) => {
  const entries: FilterEntry[] = [];

  if (filters.agent) {
    entries.push({ key: 'agent', label: `agent: ${filters.agent}` });
  }
  if (filters.project) {
    entries.push({ key: 'project', label: `project: ${filters.project}` });
  }
  if (filters.thread) {
    entries.push({ key: 'thread', label: `in: ${filters.thread}` });
  }
  if (filters.role) {
    entries.push({ key: 'role', label: `from: ${filters.role}` });
  }
  if (filters.hasFile) {
    entries.push({ key: 'hasFile', label: 'has: file' });
  }
  if (filters.fileName) {
    entries.push({ key: 'fileName', label: `file: ${filters.fileName}` });
  }
  if (filters.before) {
    entries.push({
      key: 'before',
      label: `before: ${filters.before.toISOString().split('T')[0]}`,
    });
  }
  if (filters.after) {
    entries.push({
      key: 'after',
      label: `after: ${filters.after.toISOString().split('T')[0]}`,
    });
  }

  return entries;
};

type SearchFilterChipsComponent = (props: SearchFilterChipsProps) => React.ReactNode;

export const SearchFilterChips: SearchFilterChipsComponent = ({ filters, onRemoveFilter }) => {
  const entries = buildEntries(filters);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className='flex flex-wrap gap-1.5 border-b border-border/40 px-3 py-2'>
      {entries.map((entry) => (
        <Badge key={entry.key} variant='outline' className='gap-1 py-0.5 pr-1 text-xs font-normal'>
          {entry.label}
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation();
              onRemoveFilter(entry.key);
            }}
            className='ml-0.5 rounded-full p-0.5 hover:bg-muted'
            aria-label={`Remove ${entry.label} filter`}
          >
            <X className='h-3 w-3' />
          </button>
        </Badge>
      ))}
    </div>
  );
};
