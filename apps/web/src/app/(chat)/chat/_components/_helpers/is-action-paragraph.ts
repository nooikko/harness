// Detects whether a paragraph's children represent a fully-italic action beat.
// Action beats in narrative markdown are written as *italic paragraphs* and
// render as a <p> containing only <em> elements (plus whitespace strings).
//
// When react-markdown uses custom component overrides, the element type is the
// override function — not the string 'em'. So we check for both native elements
// and custom components by looking at the element's props structure.

import { Children, isValidElement, type ReactNode } from 'react';

type IsEmLike = (node: ReactNode) => boolean;
const isEmLike: IsEmLike = (node) => {
  if (!isValidElement(node)) {
    return false;
  }
  // Native <em> element
  if (node.type === 'em') {
    return true;
  }
  // Custom component override for em — react-markdown passes the original
  // tag name as a prop or the component is a function (our override).
  // The key signal: it's a function component (our override) with children + node prop.
  if (typeof node.type === 'function') {
    const props = node.props as Record<string, unknown>;
    // react-markdown passes 'node' prop to custom components
    if ('node' in props) {
      return true;
    }
  }
  return false;
};

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
    if (isEmLike(node)) {
      hasEm = true;
      continue;
    }
    // Any non-em, non-whitespace element means this isn't a pure action paragraph
    return false;
  }

  return hasEm;
};
