// @refresh reset
'use client';

import { Button } from '@harness/ui';
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
import { useCallback, useEffect, useRef, useState } from 'react';
import { CommandMenu } from '../_helpers/command-menu';
import { CommandMenuItem } from '../_helpers/command-menu-item';
import { CommandNode } from '../_helpers/command-node';
import { COMMANDS } from '../_helpers/commands';
import { SubmitPlugin } from '../_helpers/submit-plugin';
import { AgentSelector } from './agent-selector';
import { ModelSelector } from './model-selector';

// Static — module-level so Lexical does not warn about a new config reference on every render.
// Extra scalar fields are flat (required by BeautifulMentionsItem type) and stripped
// in CommandMenuItem before spreading to DOM.
const MENTION_ITEMS = {
  '/': COMMANDS.map(({ name, description, args, category, pluginName }) => ({
    value: name,
    description,
    args,
    category,
    pluginName: pluginName ?? '',
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
      size='icon'
      className='h-7 w-7'
      disabled={disabled}
      onClick={() => editor.dispatchCommand(KEY_ENTER_COMMAND, null as unknown as KeyboardEvent)}
      aria-label='Send message'
    >
      <SendHorizontal className='h-3.5 w-3.5' />
    </Button>
  );
};

type ChatInputProps = {
  threadId: string;
  currentModel: string | null;
  currentAgentId: string | null;
  currentAgentName: string | null;
  onSubmitAction: (text: string) => void;
  disabled?: boolean;
  error?: string | null;
};

type ChatInputComponent = (props: ChatInputProps) => React.ReactNode;

export const ChatInput: ChatInputComponent = ({
  threadId,
  currentModel,
  currentAgentId,
  currentAgentName,
  onSubmitAction,
  disabled = false,
  error,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  // Stable ref so SubmitPlugin's useEffect does not re-register on every render
  // when the parent passes a new function reference.
  const onSubmitRef = useRef(onSubmitAction);
  onSubmitRef.current = onSubmitAction;

  const stableOnSubmit = useCallback((text: string) => {
    onSubmitRef.current(text);
  }, []);

  // Measure the card container and publish its position as CSS variables so the
  // slash-command menu can be positioned with `position: fixed` at exactly the
  // top edge of this card (0 clearance) and at full width.
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cardRef.current;
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
    <div className='mx-auto w-full max-w-4xl bg-background px-4 pb-4 pt-3 shadow-[0_-1px_3px_0_rgba(0,0,0,0.04)] sm:px-6'>
      {error && <p className='mb-2 text-xs text-destructive'>{error}</p>}
      <LexicalComposer initialConfig={EDITOR_CONFIG}>
        {/* Unified card: text area on top, controls row on bottom */}
        <div
          ref={cardRef}
          className={menuOpen ? 'rounded-b-xl border-x border-b border-border bg-background' : 'rounded-xl border border-border bg-background'}
        >
          {/* Text editing area */}
          <div className='group/input relative px-3 pt-2 pb-1'>
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className='max-h-34 min-h-10 resize-none overflow-y-auto text-sm outline-none'
                  aria-placeholder='Send a message… (/ for commands)'
                  placeholder={
                    <div className='pointer-events-none absolute left-3 top-2.5 select-none text-sm text-muted-foreground group-focus-within/input:hidden'>
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
              insertOnBlur={false}
              onMenuOpen={() => setMenuOpen(true)}
              onMenuClose={() => setMenuOpen(false)}
            />
            <HistoryPlugin />
            <SubmitPlugin threadId={threadId} onSubmit={stableOnSubmit} disabled={disabled} />
          </div>
          {/* Controls row: agent + model selectors left, send button right */}
          <div className='flex items-center justify-between px-3 pb-2'>
            <div className='flex items-center gap-2'>
              <AgentSelector threadId={threadId} currentAgentId={currentAgentId} currentAgentName={currentAgentName} />
              <ModelSelector threadId={threadId} currentModel={currentModel} />
            </div>
            <SendButton disabled={disabled} />
          </div>
        </div>
        <p className='mt-1 text-[10px] text-muted-foreground/40'>Enter to send · Shift+Enter for new line · / for commands</p>
      </LexicalComposer>
    </div>
  );
};
