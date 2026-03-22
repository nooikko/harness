// Detects whether a paragraph's children represent a fully-italic action beat.
// Action beats in narrative markdown are written as *italic paragraphs* and
// render as a <p> containing only <em> elements (plus whitespace strings).

import { Children, isValidElement, type ReactNode } from 'react';

type IsActionParagraph = (children: ReactNode) => boolean;

export const isActionParagraph: IsActionParagraph = (children) => {
  const arr = Children.toArray(children);
  if (arr.length === 0) {
    return false;
  }

  let hasEm = false;

  for (const node of arr) {
    if (typeof node === 'string') {
      // Allow whitespace-only strings between em elements
      if (node.trim() !== '') {
        return false;
      }
      continue;
    }
    if (isValidElement(node) && node.type === 'em') {
      hasEm = true;
      continue;
    }
    // Any non-em, non-whitespace element means this isn't a pure action paragraph
    return false;
  }

  return hasEm;
};
