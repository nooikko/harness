import type { InitialConfigType } from '@lexical/react/LexicalComposer';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import type { Spread } from 'lexical';
import { $getRoot, COMMAND_PRIORITY_LOW, KEY_ENTER_COMMAND } from 'lexical';
import type {
  BeautifulMentionComponentProps,
  BeautifulMentionsMenuItemProps,
  BeautifulMentionsMenuProps,
  SerializedBeautifulMentionNode,
} from 'lexical-beautiful-mentions';
import { BeautifulMentionNode, BeautifulMentionsPlugin } from 'lexical-beautiful-mentions';
import type { ElementType } from 'react';
import * as React from 'react';
import { Button } from '../components/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '../components/popover';

// ─── Command chip (rendered inside editor after selection) ────────────────────

const CommandChip = ({ trigger, value }: BeautifulMentionComponentProps) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0,
      borderRadius: 'var(--radius-sm)',
      background: 'var(--accent-subtle)',
      padding: '2px 6px',
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      fontWeight: 500,
      color: 'var(--accent)',
      boxShadow: 'inset 0 0 0 1px var(--border)',
      lineHeight: 1.4,
    }}
  >
    <span style={{ opacity: 0.5 }}>{trigger}</span>
    {value}
  </span>
);

// ─── Command node ─────────────────────────────────────────────────────────────

type SerializedCommandNode = Spread<{ type: 'command-mention' }, SerializedBeautifulMentionNode>;

class CommandNode extends BeautifulMentionNode {
  static getType(): string {
    return 'command-mention';
  }

  static clone(node: CommandNode): CommandNode {
    return new CommandNode(node.getTrigger(), node.getValue(), node.getData(), node.__key);
  }

  static importJSON(serializedNode: SerializedBeautifulMentionNode): CommandNode {
    return new CommandNode(serializedNode.trigger, serializedNode.value, serializedNode.data);
  }

  exportJSON(): SerializedCommandNode {
    return { ...super.exportJSON(), type: 'command-mention' };
  }

  component(): ElementType<BeautifulMentionComponentProps> | null {
    return CommandChip;
  }
}

// ─── Command menu popup ───────────────────────────────────────────────────────

const CommandMenu = React.forwardRef<HTMLUListElement, BeautifulMentionsMenuProps>(({ loading: _loading, children, ...props }, ref) => (
  <ul
    ref={ref}
    style={{
      listStyle: 'none',
      margin: 0,
      padding: '4px 0',
      borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
      border: '1px solid var(--border)',
      borderBottom: 'none',
      background: 'var(--surface-page)',
      maxHeight: 'min(400px, 50vh)',
      overflowY: 'auto',
      zIndex: 50,
    }}
    {...props}
  >
    <li
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        padding: '8px 12px 4px',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      Commands
    </li>
    {children}
  </ul>
));

CommandMenu.displayName = 'CommandMenu';

// ─── Command menu item ────────────────────────────────────────────────────────

const CommandMenuItem = React.forwardRef<HTMLLIElement, BeautifulMentionsMenuItemProps>(({ selected, item, ...props }, ref) => {
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
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        borderRadius: 'var(--radius-sm)',
        padding: '6px 12px',
        fontSize: 12,
        cursor: 'pointer',
        outline: 'none',
        background: selected ? 'var(--accent)' : 'transparent',
        color: selected ? 'var(--text-on-accent)' : 'var(--text-primary)',
        transition: 'background 0.1s',
      }}
      {...rest}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)' }}>
        <span style={{ fontWeight: 600 }}>/{item.value}</span>
        {pluginName && (
          <span
            style={{
              borderRadius: 'var(--radius-sm)',
              background: selected ? 'rgba(255,255,255,0.2)' : 'var(--surface-active)',
              padding: '1px 4px',
              fontSize: 10,
              fontWeight: 400,
              color: selected ? 'var(--text-on-accent)' : 'var(--text-tertiary)',
              fontFamily: 'inherit',
            }}
          >
            {pluginName}
          </span>
        )}
      </span>
      {description && (
        <span
          style={{
            maxWidth: '50%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'right',
            color: selected ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary)',
          }}
        >
          {description}
        </span>
      )}
    </li>
  );
});

CommandMenuItem.displayName = 'CommandMenuItem';

// ─── Submit plugin (simplified — no Next.js router or server actions) ─────────

type SubmitPluginProps = {
  onSubmit: (text: string) => void;
  disabled: boolean;
};

const SubmitPlugin = ({ onSubmit, disabled }: SubmitPluginProps) => {
  const [editor] = useLexicalComposerContext();

  React.useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        if (event?.shiftKey) {
          return false;
        }
        if (disabled) {
          event?.preventDefault();
          return true;
        }
        const text = editor.read(() => $getRoot().getTextContent().trim());
        if (!text) {
          return true;
        }
        event?.preventDefault();
        editor.update(() => {
          $getRoot().clear();
        });
        onSubmit(text);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, onSubmit, disabled]);

  return null;
};

// ─── Send button (must live inside LexicalComposer) ───────────────────────────

const SendButton = ({ disabled }: { disabled: boolean }) => {
  const [editor] = useLexicalComposerContext();
  return (
    <Button
      type='button'
      size='sm'
      disabled={disabled}
      onClick={() => editor.dispatchCommand(KEY_ENTER_COMMAND, null as unknown as KeyboardEvent)}
      aria-label='Send message'
    >
      Send ↵
    </Button>
  );
};

// ─── Demo data ────────────────────────────────────────────────────────────────

type DemoCommand = {
  name: string;
  description: string;
  args: string;
  category: 'system' | 'tool';
  pluginName?: string;
};

const DEMO_COMMANDS: DemoCommand[] = [
  { name: 'model', description: 'Change the AI model for this thread', args: '<model-name>', category: 'system' },
  { name: 'new', description: 'Start a fresh conversation in a new thread', args: '', category: 'system' },
  {
    name: 'schedule_task',
    description: 'Create a scheduled task that fires a prompt',
    args: '<name> <prompt> <schedule>',
    category: 'tool',
    pluginName: 'cron',
  },
  { name: 'delegate', description: 'Delegate a task to a sub-agent', args: '<prompt>', category: 'tool', pluginName: 'delegation' },
  { name: 'update_self', description: 'Update your own identity and soul', args: '', category: 'tool', pluginName: 'identity' },
  { name: 'current_time', description: 'Get the current time in the configured timezone', args: '', category: 'tool', pluginName: 'time' },
];

const MENTION_ITEMS = {
  '/': DEMO_COMMANDS.map(({ name, description, args, category, pluginName }) => ({
    value: name,
    description,
    args,
    category,
    pluginName: pluginName ?? '',
  })),
};

const DEMO_AGENTS = ['primary', 'dev', 'home'];
const DEMO_MODELS = [
  { id: 'claude-haiku-4-5', label: 'Haiku' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet' },
  { id: 'claude-opus-4-6', label: 'Opus' },
];

// ─── Ghost selector trigger ───────────────────────────────────────────────────

type SelectorTriggerProps = { label: string; onClick?: () => void };

const SelectorTrigger = React.forwardRef<HTMLButtonElement, SelectorTriggerProps>(({ label, onClick, ...props }, ref) => (
  <button
    ref={ref}
    type='button'
    onClick={onClick}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'var(--surface-hover)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent';
    }}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      fontSize: 12,
      fontWeight: 500,
      color: 'var(--text-secondary)',
      padding: '2px 6px',
      borderRadius: 'var(--radius-sm)',
      fontFamily: 'inherit',
      transition: 'background 0.1s',
    }}
    {...props}
  >
    {label}
    <span style={{ fontSize: 9, opacity: 0.45, lineHeight: 1 }}>⌄</span>
  </button>
));

SelectorTrigger.displayName = 'SelectorTrigger';

// ─── Editor config (module-level — avoids Lexical warnings on re-render) ──────

const EDITOR_CONFIG: InitialConfigType = {
  namespace: 'DesignChatInput',
  nodes: [
    CommandNode,
    {
      replace: BeautifulMentionNode,
      with: (node: BeautifulMentionNode) => new CommandNode(node.getTrigger(), node.getValue(), node.getData()),
    },
  ],
  onError: (error: Error) => {
    throw error;
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatInputProps = {
  initialAgent?: string;
  initialModel?: string;
  onSend?: (text: string) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

const ChatInput = ({ initialAgent = 'primary', initialModel = 'claude-sonnet-4-6', onSend }: ChatInputProps) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [agent, setAgent] = React.useState(initialAgent);
  const [model, setModel] = React.useState(initialModel);
  const modelLabel = DEMO_MODELS.find((m) => m.id === model)?.label ?? 'Sonnet';

  // Publish card position as CSS variables so the slash-command menu can use
  // position: fixed to anchor itself to the top edge of this card.
  const cardRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
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
    <div style={{ width: '100%' }}>
      <LexicalComposer initialConfig={EDITOR_CONFIG}>
        {/* Unified card: text area on top, controls row on bottom */}
        <div
          ref={cardRef}
          style={{
            background: 'var(--surface-page)',
            border: '1px solid var(--border)',
            borderTop: menuOpen ? 'none' : '1px solid var(--border)',
            borderRadius: menuOpen ? '0 0 var(--radius-xl) var(--radius-xl)' : 'var(--radius-xl)',
            overflow: 'hidden',
          }}
        >
          {/* Text editing area */}
          <div style={{ position: 'relative', padding: '10px 14px 6px' }}>
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  style={{
                    minHeight: 40,
                    maxHeight: 136,
                    overflowY: 'auto',
                    fontSize: 14,
                    outline: 'none',
                    color: 'var(--text-primary)',
                    lineHeight: 1.6,
                    fontFamily: 'inherit',
                  }}
                  aria-placeholder='Send a message… (/ for commands)'
                  placeholder={
                    <div
                      style={{
                        position: 'absolute',
                        left: 14,
                        top: 10,
                        pointerEvents: 'none',
                        userSelect: 'none',
                        fontSize: 14,
                        color: 'var(--text-tertiary)',
                        lineHeight: 1.6,
                      }}
                    >
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
            <SubmitPlugin onSubmit={(text) => onSend?.(text)} disabled={false} />
          </div>

          {/* Controls row: agent + model selectors left, send button right */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Popover>
                <PopoverTrigger asChild>
                  <SelectorTrigger label={agent} />
                </PopoverTrigger>
                <PopoverContent width={160} padding={6} sideOffset={6}>
                  {DEMO_AGENTS.map((a) => (
                    <button
                      key={a}
                      type='button'
                      onClick={() => setAgent(a)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '6px 8px',
                        background: agent === a ? 'var(--accent-subtle)' : 'transparent',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        textAlign: 'left',
                        fontSize: 12,
                        fontWeight: agent === a ? 600 : 400,
                        color: agent === a ? 'var(--accent)' : 'var(--text-primary)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {a}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SelectorTrigger label={modelLabel} />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {DEMO_MODELS.map((m) => (
                    <DropdownMenuItem key={m.id} onClick={() => setModel(m.id)}>
                      {m.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <SendButton disabled={false} />
          </div>
        </div>

        <p
          style={{
            marginTop: 6,
            fontSize: 11,
            color: 'var(--text-tertiary)',
            paddingLeft: 4,
          }}
        >
          Enter to send · Shift+Enter for new line · / for commands
        </p>
      </LexicalComposer>
    </div>
  );
};

export { ChatInput };
export type { ChatInputProps };
