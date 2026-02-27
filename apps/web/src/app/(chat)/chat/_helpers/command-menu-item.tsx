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
        'flex cursor-pointer flex-col gap-0.5 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
        selected ? 'bg-accent text-accent-foreground' : 'text-popover-foreground',
      )}
      {...rest}
    >
      <div className='flex items-center gap-2'>
        <span className='font-mono font-medium'>/{item.value}</span>
        {args && <span className='text-xs text-muted-foreground'>{args}</span>}
      </div>
      {description && <span className='text-xs text-muted-foreground'>{description}</span>}
    </li>
  );
});

CommandMenuItem.displayName = 'CommandMenuItem';

export { CommandMenuItem };
