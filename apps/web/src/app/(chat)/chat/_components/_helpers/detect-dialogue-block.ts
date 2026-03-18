import { Children, isValidElement, type ReactNode } from 'react';

type DialogueResult =
  | { isDialogue: false }
  | {
      isDialogue: true;
      speaker: string;
      emotion?: string;
      restChildren: ReactNode;
    };

type DetectDialogueBlock = (children: ReactNode) => DialogueResult;

const NO_DIALOGUE: DialogueResult = { isDialogue: false };

type ExtractText = (node: ReactNode) => string;
const extractText: ExtractText = (node) => {
  if (typeof node === 'string') {
    return node;
  }
  if (typeof node === 'number') {
    return String(node);
  }
  if (isValidElement(node) && node.props) {
    const props = node.props as { children?: ReactNode };
    return props.children ? extractText(props.children) : '';
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join('');
  }
  return '';
};

type IsStrongElement = (node: ReactNode) => boolean;
const isStrongElement: IsStrongElement = (node) => {
  if (!isValidElement(node)) {
    return false;
  }
  return node.type === 'strong';
};

type IsEmElement = (node: ReactNode) => boolean;
const isEmElement: IsEmElement = (node) => {
  if (!isValidElement(node)) {
    return false;
  }
  return node.type === 'em';
};

export const detectDialogueBlock: DetectDialogueBlock = (children) => {
  const arr = Children.toArray(children);

  if (arr.length === 0) {
    return NO_DIALOGUE;
  }

  const first = arr[0];
  if (!isStrongElement(first)) {
    return NO_DIALOGUE;
  }

  const speaker = extractText((first as React.ReactElement<{ children?: ReactNode }>).props.children);
  if (!speaker) {
    return NO_DIALOGUE;
  }

  // Scan remaining elements for an optional <em> (emotion) and the colon-quote string.
  // Whitespace-only strings between strong and em/colon are skipped.
  let emotion: string | undefined;
  let colonIndex = -1;

  for (let i = 1; i < arr.length; i++) {
    const node = arr[i];

    // Skip whitespace-only strings
    if (typeof node === 'string' && node.trim() === '') {
      continue;
    }

    // Check for emotion <em> element (must appear before colon-quote)
    if (colonIndex === -1 && isEmElement(node)) {
      emotion = extractText((node as React.ReactElement<{ children?: ReactNode }>).props.children);
      if (emotion?.startsWith('(') && emotion.endsWith(')')) {
        emotion = emotion.slice(1, -1);
      }
      continue;
    }

    // Check for colon-quote string
    if (typeof node === 'string' && node.includes(': "')) {
      colonIndex = i;
      break;
    }

    // Unexpected element — not a dialogue pattern
    return NO_DIALOGUE;
  }

  if (colonIndex === -1) {
    return NO_DIALOGUE;
  }

  // Build rest children: the colon-text part onward + remaining elements
  const restChildren = arr.slice(colonIndex);

  return {
    isDialogue: true,
    speaker,
    ...(emotion ? { emotion } : {}),
    restChildren,
  };
};
