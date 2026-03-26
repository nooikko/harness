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
import { Paperclip, SendHorizontal } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CommandMenu } from '../_helpers/command-menu';
import { CommandMenuItem } from '../_helpers/command-menu-item';
import { CommandNode } from '../_helpers/command-node';
import { COMMANDS } from '../_helpers/commands';
import { SubmitPlugin } from '../_helpers/submit-plugin';
import { FileChip } from './file-chip';
import { InputSettingsPopover } from './input-settings-popover';
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
      withKlass: CommandNode,
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

type StagedFile = {
  file: File;
  id: string;
};

type UploadStagedFiles = (threadId: string, files: StagedFile[]) => Promise<string[]>;

const uploadStagedFiles: UploadStagedFiles = async (threadId, files) => {
  const results = await Promise.all(
    files.map(async (staged) => {
      const formData = new FormData();
      formData.append('file', staged.file);
      formData.append('threadId', threadId);
      formData.append('scope', 'THREAD');
      const res = await fetch('/api/files', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Upload failed');
      }
      const data = await res.json();
      return data.id as string;
    }),
  );
  return results;
};

type ChatInputProps = {
  threadId: string | null;
  currentModel: string | null;
  currentAgentId: string | null;
  currentAgentName: string | null;
  currentEffort: string | null;
  currentPermissionMode: string | null;
  onSubmitAction: (text: string, fileIds?: string[]) => void;
  onAgentChange?: (agentId: string, agentName: string) => void;
  onModelChange?: (model: string | null) => void;
  onEffortChange?: (effort: string | null) => void;
  onPermissionModeChange?: (mode: string | null) => void;
  disabled?: boolean;
  error?: string | null;
};

type ChatInputComponent = (props: ChatInputProps) => React.ReactNode;

export const ChatInput: ChatInputComponent = ({
  threadId,
  currentModel,
  currentAgentId,
  currentAgentName,
  currentEffort,
  currentPermissionMode,
  onSubmitAction,
  onAgentChange,
  onModelChange,
  onEffortChange,
  onPermissionModeChange,
  disabled = false,
  error,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stable ref so SubmitPlugin's useEffect does not re-register on every render
  // when the parent passes a new function reference.
  const onSubmitRef = useRef(onSubmitAction);
  onSubmitRef.current = onSubmitAction;

  const stableOnSubmit = useCallback(
    async (text: string) => {
      let fileIds: string[] | undefined;
      if (stagedFiles.length > 0 && threadId) {
        setIsUploading(true);
        setUploadError(null);
        try {
          fileIds = await uploadStagedFiles(threadId, stagedFiles);
          setStagedFiles([]);
        } catch (err) {
          setUploadError(err instanceof Error ? err.message : 'Upload failed');
          setIsUploading(false);
          return;
        }
        setIsUploading(false);
      }
      onSubmitRef.current(text, fileIds);
    },
    [stagedFiles, threadId],
  );

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) {
      return;
    }
    const newFiles: StagedFile[] = Array.from(selected).map((f) => ({
      file: f,
      id: crypto.randomUUID(),
    }));
    setStagedFiles((prev) => [...prev, ...newFiles]);
    e.target.value = '';
  }, []);

  const removeStagedFile = useCallback((id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
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
    <div className='mx-auto w-full max-w-4xl bg-background px-4 pb-4 pt-3 sm:px-6'>
      {(error || uploadError) && <p className='mb-2 text-xs text-destructive'>{error || uploadError}</p>}
      <input
        ref={fileInputRef}
        type='file'
        multiple
        className='hidden'
        onChange={handleFileSelect}
        accept='image/*,application/pdf,text/*,application/json,.ts,.tsx,.js,.jsx,.py,.rb,.go,.rs,.sh,.yml,.yaml,.toml,.sql,.xml'
      />
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
            <SubmitPlugin threadId={threadId} onSubmit={stableOnSubmit} disabled={disabled || isUploading} />
          </div>
          {/* Staged file chips */}
          {stagedFiles.length > 0 && (
            <div className='flex flex-wrap gap-1.5 px-3 pb-2'>
              {stagedFiles.map((staged) => (
                <FileChip
                  key={staged.id}
                  file={{ id: staged.id, name: staged.file.name, mimeType: staged.file.type || 'application/octet-stream', size: staged.file.size }}
                  onRemove={() => removeStagedFile(staged.id)}
                />
              ))}
            </div>
          )}
          {/* Controls row: attach + model left, settings + send right */}
          <div className='flex items-center justify-between px-3 pb-2'>
            <div className='flex items-center gap-2'>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='h-7 w-7 p-0 text-muted-foreground hover:text-foreground'
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isUploading || !threadId}
                aria-label='Attach file'
              >
                <Paperclip className='h-3.5 w-3.5' />
              </Button>
              <ModelSelector threadId={threadId} currentModel={currentModel} onModelChange={onModelChange} />
            </div>
            <div className='flex items-center gap-1'>
              <InputSettingsPopover
                threadId={threadId}
                currentModel={currentModel}
                currentAgentId={currentAgentId}
                currentAgentName={currentAgentName}
                currentEffort={currentEffort}
                currentPermissionMode={currentPermissionMode}
                onAgentChange={onAgentChange}
                onEffortChange={onEffortChange}
                onPermissionModeChange={onPermissionModeChange}
              />
              <SendButton disabled={disabled || isUploading} />
            </div>
          </div>
        </div>
        <p className='mt-1 text-[10px] text-muted-foreground/40'>Enter to send · Shift+Enter for new line · / for commands</p>
      </LexicalComposer>
    </div>
  );
};
