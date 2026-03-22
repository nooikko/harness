'use client';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@harness/ui';
import { Check, ChevronDown } from 'lucide-react';
import { useTransition } from 'react';
import { updateThreadModel } from '../_actions/update-thread-model';
import { MODEL_OPTIONS } from '../_helpers/model-options';

type ModelSelectorProps = {
  threadId: string;
  currentModel: string | null;
};

const getModelLabel = (model: string | null): string => {
  const resolved = model ?? 'haiku';
  const option = MODEL_OPTIONS.find((o) => o.value === resolved);
  return option?.label ?? resolved;
};

type ModelSelectorComponent = (props: ModelSelectorProps) => React.ReactNode;

export const ModelSelector: ModelSelectorComponent = ({ threadId, currentModel }) => {
  const [isPending, startTransition] = useTransition();

  const handleSelect = (value: string) => {
    startTransition(async () => {
      await updateThreadModel(threadId, value || null);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className='flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50'
        aria-label='Select model'
      >
        {getModelLabel(currentModel)}
        <ChevronDown className='h-3 w-3' />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' side='top' className='w-36'>
        {MODEL_OPTIONS.map((opt) => (
          <DropdownMenuItem key={opt.value} onClick={() => handleSelect(opt.value)} className='flex items-center justify-between text-xs'>
            <span>
              {opt.label}
              {opt.description ? <span className='ml-1 text-muted-foreground'>({opt.description})</span> : null}
            </span>
            {(currentModel ?? 'haiku') === opt.value && <Check className='h-3 w-3 shrink-0' />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
