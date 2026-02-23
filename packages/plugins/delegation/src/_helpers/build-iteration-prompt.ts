// Builds the iteration prompt, appending rejection feedback when available

type BuildIterationPrompt = (originalPrompt: string, feedback: string | undefined) => string;

export const buildIterationPrompt: BuildIterationPrompt = (originalPrompt, feedback) => {
  if (!feedback) {
    return originalPrompt;
  }
  return `${originalPrompt}\n\n---\n\nPrevious attempt was rejected with the following feedback:\n\n${feedback}`;
};
