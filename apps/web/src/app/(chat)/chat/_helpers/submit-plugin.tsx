// @refresh reset
'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, COMMAND_PRIORITY_HIGH, KEY_ENTER_COMMAND } from 'lexical';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { createThread } from '../_actions/create-thread';
import { updateThreadModel } from '../_actions/update-thread-model';

const SYSTEM_COMMANDS = new Set(['new', 'clear', 'model']);

// Matches exactly: /commandname optionalArgs — must start at position 0.
const SYSTEM_COMMAND_RE = /^\/([a-z-]+)(?:\s+(.+))?$/;

type SystemCommand = { command: string; args: string };

// Pure function — unit-testable without any Lexical setup.
const parseSystemCommand = (text: string): SystemCommand | null => {
  const match = SYSTEM_COMMAND_RE.exec(text.trim());
  if (!match) {
    return null;
  }
  const command = match[1];
  const args = match[2] ?? '';
  if (!command || !SYSTEM_COMMANDS.has(command)) {
    return null;
  }
  return { command, args: args.trim() };
};

type SubmitPluginProps = {
  threadId: string;
  onSubmit: (text: string) => void;
  disabled: boolean;
};

type SubmitPluginComponent = (props: SubmitPluginProps) => null;

// Lexical plugin: registers a KEY_ENTER_COMMAND handler at HIGH priority.
// Returns null — plugins are React components with no rendered output.
const SubmitPlugin: SubmitPluginComponent = ({ threadId, onSubmit, disabled }) => {
  const [editor] = useLexicalComposerContext();
  const router = useRouter();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        // Shift+Enter → new line. Return false to let RichTextPlugin handle it.
        if (event?.shiftKey) {
          return false;
        }

        // Blocked during pending transitions — swallow the event.
        if (disabled) {
          event?.preventDefault();
          return true;
        }

        const text = editor.read(() => $getRoot().getTextContent().trim());
        if (!text) {
          return true;
        }

        event?.preventDefault();

        // Clear the editor — called from within a command listener, so we must
        // NOT use { discrete: true } (discrete nested updates require a non-empty
        // pending state, which the outer dispatchCommand context may not have).
        // The update is deferred to the next microtask by Lexical automatically.
        editor.update(() => {
          $getRoot().clear();
        });

        const system = parseSystemCommand(text);

        if (system?.command === 'new' || system?.command === 'clear') {
          createThread().then(({ threadId: newId }) => {
            router.push(`/chat/${newId}`);
          });
          return true;
        }

        if (system?.command === 'model') {
          updateThreadModel(threadId, system.args || null).then(() => {
            router.refresh();
          });
          return true;
        }

        // Regular message — hand off to ChatArea's submit handler.
        onSubmit(text);
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, threadId, onSubmit, disabled, router]);

  return null;
};

export { SubmitPlugin, parseSystemCommand };
export type { SystemCommand };
