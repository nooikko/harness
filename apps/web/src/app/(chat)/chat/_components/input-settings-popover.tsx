'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@harness/ui';
import { Bot, Check, ChevronDown, Settings } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { listAgents } from '../_actions/list-agents';
import { updateThreadAgent } from '../_actions/update-thread-agent';
import { updateThreadEffort } from '../_actions/update-thread-effort';
import { updateThreadPermissionMode } from '../_actions/update-thread-permission-mode';
import { getEffortOptions } from '../_helpers/effort-options';

type Agent = {
  id: string;
  name: string;
};

const PERMISSION_OPTIONS = [
  { value: '', label: 'Bypass (Default)' },
  { value: 'acceptEdits', label: 'Accept Edits' },
  { value: 'plan', label: 'Plan Mode' },
  { value: 'default', label: 'Ask Permission' },
] as const;

// Inline dropdown that renders options directly in the DOM (no portal)
// to avoid Radix Popover dismiss issues with nested portals.
type InlineSelectProps = {
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onSelect: (value: string) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  width?: string;
};

type InlineSelectComponent = (props: InlineSelectProps) => React.ReactNode;

const InlineSelect: InlineSelectComponent = ({ value, options, onSelect, disabled, icon, width = 'w-32' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, handleClickOutside]);

  const currentLabel = options.find((o) => o.value === value)?.label ?? value;

  return (
    <div ref={ref} className='relative'>
      <button
        type='button'
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className='flex items-center gap-1 text-xs text-foreground transition-colors hover:text-foreground/80 disabled:opacity-50'
      >
        {icon}
        <span className='max-w-28 truncate'>{currentLabel}</span>
        <ChevronDown className='h-3 w-3 text-muted-foreground' />
      </button>
      {open && (
        <div className={`absolute right-0 bottom-full mb-1 ${width} rounded-md border border-border bg-popover p-1 shadow-md`} style={{ zIndex: 60 }}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type='button'
              onClick={() => {
                onSelect(opt.value);
                setOpen(false);
              }}
              className='flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-xs hover:bg-accent'
            >
              <span>{opt.label}</span>
              {value === opt.value && <Check className='h-3 w-3 shrink-0' />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

type InputSettingsPopoverProps = {
  threadId: string | null;
  currentModel: string | null;
  currentAgentId: string | null;
  currentAgentName: string | null;
  currentEffort: string | null;
  currentPermissionMode: string | null;
  onAgentChange?: (agentId: string, agentName: string) => void;
  onEffortChange?: (effort: string | null) => void;
  onPermissionModeChange?: (mode: string | null) => void;
};

type InputSettingsPopoverComponent = (props: InputSettingsPopoverProps) => React.ReactNode;

export const InputSettingsPopover: InputSettingsPopoverComponent = ({
  threadId,
  currentModel,
  currentAgentId,
  currentAgentName,
  currentEffort,
  currentPermissionMode,
  onAgentChange,
  onEffortChange,
  onPermissionModeChange,
}) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    listAgents().then((result) => {
      if (!cancelled) {
        setAgents(result.filter((a) => a.enabled).map((a) => ({ id: a.id, name: a.name })));
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAgentSelect = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) {
      return;
    }
    if (onAgentChange) {
      onAgentChange(agent.id, agent.name);
      return;
    }
    if (threadId) {
      startTransition(async () => {
        await updateThreadAgent(threadId, agent.id);
      });
    }
  };

  const handleEffortSelect = (value: string) => {
    if (onEffortChange) {
      onEffortChange(value || null);
      return;
    }
    if (threadId) {
      startTransition(async () => {
        await updateThreadEffort(threadId, value || null);
      });
    }
  };

  const handlePermissionSelect = (value: string) => {
    if (onPermissionModeChange) {
      onPermissionModeChange(value || null);
      return;
    }
    if (threadId) {
      startTransition(async () => {
        await updateThreadPermissionMode(threadId, value || null);
      });
    }
  };

  const hasNonDefault = currentEffort || currentPermissionMode;

  const agentOptions = agents.map((a) => ({ value: a.id, label: a.name }));
  const effortOptions = getEffortOptions(currentModel);

  return (
    <Popover>
      <PopoverTrigger
        className='relative flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50'
        aria-label='Chat settings'
      >
        <Settings className='h-3.5 w-3.5' />
        {hasNonDefault && <span className='absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-primary' />}
      </PopoverTrigger>
      <PopoverContent side='top' align='end' className='w-56 p-2' style={{ overflow: 'visible' }} onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className='flex flex-col gap-1.5'>
          {/* Agent */}
          <SettingsRow label='Agent'>
            <InlineSelect
              value={currentAgentId ?? ''}
              options={agentOptions}
              onSelect={handleAgentSelect}
              disabled={isPending || !loaded}
              icon={<Bot className='h-3 w-3 text-muted-foreground' />}
              width='w-36'
            />
          </SettingsRow>

          {/* Thinking Effort */}
          <SettingsRow label='Thinking'>
            <InlineSelect value={currentEffort ?? ''} options={effortOptions} onSelect={handleEffortSelect} disabled={isPending} />
          </SettingsRow>

          {/* Permission Mode */}
          <SettingsRow label='Permissions'>
            <InlineSelect
              value={currentPermissionMode ?? ''}
              options={PERMISSION_OPTIONS as unknown as Array<{ value: string; label: string }>}
              onSelect={handlePermissionSelect}
              disabled={isPending}
              width='w-40'
            />
          </SettingsRow>
        </div>
      </PopoverContent>
    </Popover>
  );
};

type SettingsRowProps = {
  label: string;
  children: React.ReactNode;
};

type SettingsRowComponent = (props: SettingsRowProps) => React.ReactNode;

const SettingsRow: SettingsRowComponent = ({ label, children }) => (
  <div className='flex items-center justify-between rounded-md px-1.5 py-1'>
    <span className='text-xs text-muted-foreground'>{label}</span>
    {children}
  </div>
);
