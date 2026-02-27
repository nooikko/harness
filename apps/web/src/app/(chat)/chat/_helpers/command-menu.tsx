'use client';

import type { BeautifulMentionsMenuProps } from 'lexical-beautiful-mentions';
import { forwardRef } from 'react';

// Floating container for the slash command list.
// lexical-beautiful-mentions positions this relative to the cursor automatically.
const CommandMenu = forwardRef<HTMLUListElement, BeautifulMentionsMenuProps>(({ loading: _loading, ...props }, ref) => (
  <ul
    ref={ref}
    className='z-50 min-w-[18rem] overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95'
    {...props}
  />
));

CommandMenu.displayName = 'CommandMenu';

export { CommandMenu };
