'use client';

import type { BeautifulMentionsMenuItemProps } from 'lexical-beautiful-mentions';
import { forwardRef } from 'react';
import { cn } from 'ui';

const CommandMenuItem = forwardRef<HTMLLIElement, BeautifulMentionsMenuItemProps>(({ selected, item, ...props }, ref) => {
  // itemValue is a plugin-internal prop — strip it before spreading to <li>
  // to avoid the "Unknown prop `itemValue`" React DOM warning.
  const { itemValue: _itemValue, ...rest } = props as typeof props & {
    itemValue?: string;
  };

  const description = typeof item.data?.description === 'string' ? item.data.description : '';
  const args = typeof item.data?.args === 'string' ? item.data.args : '';

  return (
    <li
      ref={ref}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-sm outline-none transition-colors',
        selected ? 'bg-accent text-accent-foreground' : 'text-popover-foreground',
      )}
      {...rest}
    >
      {/* Command + args as one monospace unit so they read as a single signature */}
      <span className='font-mono'>
        <span className='font-semibold'>/{item.value}</span>
        {args && <span className='font-normal text-muted-foreground'> {args}</span>}
      </span>
      {description && <span className='ml-auto truncate text-xs text-muted-foreground'>{description}</span>}
    </li>
  );
});

CommandMenuItem.displayName = 'CommandMenuItem';

export { CommandMenuItem };
