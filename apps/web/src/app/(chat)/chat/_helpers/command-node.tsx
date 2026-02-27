// @refresh reset
'use client';

import type { Spread } from 'lexical';
import type { BeautifulMentionComponentProps, SerializedBeautifulMentionNode } from 'lexical-beautiful-mentions';
import { BeautifulMentionNode } from 'lexical-beautiful-mentions';
import type { ElementType } from 'react';

// Internal chip rendered inside the Lexical editor after a command is selected.
// Styled as a secondary badge using shadcn design tokens.
const CommandChip = ({ trigger, value }: BeautifulMentionComponentProps) => (
  <span className='inline-flex items-center gap-0.5 rounded bg-secondary px-1.5 py-0.5 font-mono text-xs font-medium text-secondary-foreground ring-1 ring-inset ring-border'>
    <span className='opacity-50'>{trigger}</span>
    {value}
  </span>
);

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
    return {
      ...super.exportJSON(),
      type: 'command-mention',
    };
  }

  component(): ElementType<BeautifulMentionComponentProps> | null {
    return CommandChip;
  }

  // decorate() is intentionally not overridden — component() takes precedence
  // when defined, per lexical-beautiful-mentions docs.
}

export { CommandNode };
export type { SerializedCommandNode };
