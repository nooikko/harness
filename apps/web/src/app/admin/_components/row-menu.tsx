'use client';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@harness/ui';
import type { LucideIcon } from 'lucide-react';
import { Archive, ExternalLink, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';

// Icon lookup — only plain strings cross the server/client boundary
const ICON_MAP: Record<string, LucideIcon> = {
  'external-link': ExternalLink,
  archive: Archive,
  pencil: Pencil,
  trash: Trash2,
};

type RowMenuAction = {
  label: string;
  /** Icon key from ICON_MAP — serializable across server/client boundary */
  icon?: string;
  href?: string;
  onClick?: () => void | Promise<void>;
  /** When true, first click shows "label?" in red, second click confirms. Resets after 3s. */
  destructive?: boolean;
};

type RowMenuProps = {
  actions: RowMenuAction[];
};

type RowMenuComponent = (props: RowMenuProps) => React.ReactNode;

export const RowMenu: RowMenuComponent = ({ actions }) => {
  const [confirmingIndex, setConfirmingIndex] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = (action: RowMenuAction, index: number) => {
    if (action.destructive && confirmingIndex !== index) {
      setConfirmingIndex(index);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => setConfirmingIndex(null), 3000);
      return;
    }

    setConfirmingIndex(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (action.href) {
      window.location.href = action.href;
      return;
    }

    if (action.onClick) {
      startTransition(async () => {
        await action.onClick?.();
      });
    }
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) {
          setConfirmingIndex(null);
          if (timerRef.current) {
            clearTimeout(timerRef.current);
          }
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          className='flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover/row:opacity-100 data-[state=open]:opacity-100'
          aria-label='Row actions'
        >
          <MoreHorizontal className='h-4 w-4' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='min-w-35'>
        {actions.map((action, index) => {
          const isConfirming = action.destructive && confirmingIndex === index;
          const Icon = action.icon ? ICON_MAP[action.icon] : undefined;

          return (
            <DropdownMenuItem
              key={action.label}
              onClick={(e) => {
                if (action.destructive) {
                  e.preventDefault();
                }
                handleClick(action, index);
              }}
              className={isConfirming ? 'text-destructive focus:text-destructive' : ''}
            >
              {Icon && <Icon className='h-3.5 w-3.5' />}
              {isConfirming ? `${action.label}?` : action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
