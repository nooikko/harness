// @refresh reset
'use client';

import type { InitialConfigType } from '@lexical/react/LexicalComposer';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { KEY_ENTER_COMMAND } from 'lexical';
import { BeautifulMentionNode, BeautifulMentionsPlugin } from 'lexical-beautiful-mentions';
import { SendHorizontal } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { Button } from 'ui';
import { CommandMenu } from '../_helpers/command-menu';
import { CommandMenuItem } from '../_helpers/command-menu-item';
import { CommandNode } from '../_helpers/command-node';
import { COMMANDS } from '../_helpers/commands';
import { SubmitPlugin } from '../_helpers/submit-plugin';

// Static — module-level so Lexical does not warn about a new config reference on every render.
// Extra scalar fields (description, args, category) are passed through as BeautifulMentionsItem
// flat properties and exposed to the menu item component via item.data.
const MENTION_ITEMS = {
  '/': COMMANDS.map(({ name, description, args, category }) => ({
    value: name,
    description,
    args,
    category,
  })),
};

const EDITOR_CONFIG: InitialConfigType = {
  namespace: 'ChatInput',
  nodes: [
    CommandNode,
    // Node Override: replace every BeautifulMentionNode the plugin creates
    // with a CommandNode so the custom chip component is used.
    {
      replace: BeautifulMentionNode,
      with: (node: BeautifulMentionNode) => new CommandNode(node.getTrigger(), node.getValue(), node.getData()),
    },
  ],
  onError: (error: Error) => {
    throw error;
  },
};

// Inner component — must live inside LexicalComposer to call useLexicalComposerContext.
type SendButtonProps = { disabled: boolean };
const SendButton = ({ disabled }: SendButtonProps) => {
  const [editor] = useLexicalComposerContext();
  return (
    <Button
      type='button'
      size='sm'
      disabled={disabled}
      onClick={() => editor.dispatchCommand(KEY_ENTER_COMMAND, null as unknown as KeyboardEvent)}
      aria-label='Send message'
    >
      <SendHorizontal className='h-4 w-4' />
    </Button>
  );
};

type ChatInputProps = {
  threadId: string;
  onSubmit: (text: string) => void;
  disabled?: boolean;
  error?: string | null;
};

type ChatInputComponent = (props: ChatInputProps) => React.ReactNode;

export const ChatInput: ChatInputComponent = ({ threadId, onSubmit, disabled = false, error }) => {
  // Stable ref so SubmitPlugin's useEffect does not re-register on every render
  // when the parent passes a new function reference.
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const stableOnSubmit = useCallback((text: string) => {
    onSubmitRef.current(text);
  }, []);

  // Measure the input box and publish its position as CSS variables so the
  // slash-command menu can be positioned with `position: fixed` at exactly the
  // top edge of this box (0 clearance) and at full width.
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = inputWrapperRef.current;
    if (!el) {
      return;
    }
    const sync = () => {
      const r = el.getBoundingClientRect();
      const root = document.documentElement;
      root.style.setProperty('--chat-input-top', `${r.top}px`);
      root.style.setProperty('--chat-input-left', `${r.left}px`);
      root.style.setProperty('--chat-input-width', `${r.width}px`);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener('resize', sync);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, []);

  return (
    <div className='border-t border-border bg-card/50 px-4 py-3 shadow-[0_-1px_3px_0_rgb(0,0,0,0.05)]'>
      {error && <p className='mb-2 text-xs text-destructive'>{error}</p>}
      <LexicalComposer initialConfig={EDITOR_CONFIG}>
        <div className='flex items-end gap-2'>
          <div
            ref={inputWrapperRef}
            className='relative min-h-[40px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring/50'
          >
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className='max-h-[136px] min-h-[24px] resize-none overflow-y-auto outline-none'
                  aria-placeholder='Send a message… (/ for commands)'
                  placeholder={
                    <div className='pointer-events-none absolute left-3 top-2 select-none text-sm text-muted-foreground'>
                      Send a message… (/ for commands)
                    </div>
                  }
                />
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <BeautifulMentionsPlugin
              items={MENTION_ITEMS}
              menuComponent={CommandMenu}
              menuItemComponent={CommandMenuItem}
              menuAnchorClassName='mention-menu-anchor'
              menuItemLimit={false}
            />
            <HistoryPlugin />
            <SubmitPlugin threadId={threadId} onSubmit={stableOnSubmit} disabled={disabled} />
          </div>
          <SendButton disabled={disabled} />
        </div>
        <p className='mt-1.5 text-[11px] text-muted-foreground/60'>Enter to send · Shift+Enter for new line · / for commands</p>
      </LexicalComposer>
    </div>
  );
};
