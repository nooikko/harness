type WrapOocContent = (content: string) => string;

export const wrapOocContent: WrapOocContent = (content) => {
  return `[OUT OF CHARACTER — Author direction, not in-story]\n${content}\n[END OOC]`;
};
