'use client';

import { useTransition } from 'react';
import { updateThreadModel } from '../_actions/update-thread-model';

type ModelSelectorProps = {
  threadId: string;
  currentModel: string | null;
};

const MODEL_OPTIONS = [
  { value: '', label: 'Default (Haiku)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet' },
  { value: 'claude-opus-4-6', label: 'Opus' },
] as const;

type ModelSelectorComponent = (props: ModelSelectorProps) => React.ReactNode;

export const ModelSelector: ModelSelectorComponent = ({ threadId, currentModel }) => {
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    startTransition(async () => {
      await updateThreadModel(threadId, value || null);
    });
  };

  return (
    <select
      value={currentModel ?? ''}
      onChange={handleChange}
      disabled={isPending}
      className='rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground'
      aria-label='Select model'
    >
      {MODEL_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};
