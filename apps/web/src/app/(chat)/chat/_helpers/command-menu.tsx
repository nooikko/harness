'use client';

import type { BeautifulMentionsMenuProps } from 'lexical-beautiful-mentions';
import { forwardRef } from 'react';

// Command list that appears above the chat input. Styled to extend naturally
// from the input box: same background and border colour, no bottom border
// (the input's top border acts as the divider), rounded only on top.
const CommandMenu = forwardRef<HTMLUListElement, BeautifulMentionsMenuProps>(({ loading: _loading, ...props }, ref) => (
  <ul ref={ref} className='z-50 overflow-hidden rounded-t-xl border-x border-t border-border bg-background py-1' {...props} />
));

CommandMenu.displayName = 'CommandMenu';

export { CommandMenu };
