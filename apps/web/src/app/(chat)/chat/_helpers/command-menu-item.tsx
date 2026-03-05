'use client';

import { cn } from '@harness/ui';
import type { BeautifulMentionsMenuItemProps } from 'lexical-beautiful-mentions';
import { forwardRef } from 'react';

const CommandMenuItem = forwardRef<HTMLLIElement, BeautifulMentionsMenuItemProps>(({ selected, item, ...props }, ref) => {
  // Strip all custom props before spreading to <li>
  // to avoid React DOM warnings for unknown attributes.
  const {
    itemValue: _itemValue,
    pluginName: _pluginName,
    description: _description,
    args: _args,
    category: _category,
    ...rest
  } = props as typeof props & {
    itemValue?: string;
    pluginName?: string;
    description?: string;
    args?: string;
    category?: string;
  };

  const description = typeof item.data?.description === 'string' ? item.data.description : '';
  const pluginName = typeof item.data?.pluginName === 'string' ? item.data.pluginName : '';

  return (
    <li
      ref={ref}
      className={cn(
        'flex cursor-pointer items-center justify-between gap-4 rounded-sm px-3 py-1.5 text-xs outline-none transition-colors',
        selected ? 'bg-accent text-accent-foreground' : 'text-popover-foreground',
      )}
      {...rest}
    >
      <span className='flex items-center gap-2 font-mono'>
        <span className='font-semibold'>/{item.value}</span>
        {pluginName && <span className='rounded bg-muted px-1 py-0.5 text-[10px] font-normal text-muted-foreground'>{pluginName}</span>}
      </span>
      {description && <span className='max-w-[50%] truncate text-right text-muted-foreground/70'>{description}</span>}
    </li>
  );
});

CommandMenuItem.displayName = 'CommandMenuItem';

export { CommandMenuItem };
