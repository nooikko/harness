type BuildRubricPrompt = (params: { taskPrompt: string; result: string; iteration: number; maxIterations: number }) => string;

export const buildRubricPrompt: BuildRubricPrompt = ({ taskPrompt, result, iteration, maxIterations }) => {
  return `You are a quality reviewer evaluating the output of an AI sub-agent.

## Original Task
${taskPrompt}

## Sub-Agent Output
${result}

## Review Rubric

Answer each question:
Q1. Does the output directly address the original task? (yes/no)
Q2. Is the output complete — are there obvious missing parts? (yes/no)
Q3. Is the output coherent and free from internal contradictions? (yes/no)
Q4. Would this output require significant rework to be useful? (yes/no)

## Verdict

After answering the rubric questions, state your verdict on its own line:

VERDICT: PASS   (if Q1=yes, Q2=yes, Q3=yes, Q4=no)
VERDICT: FAIL   (otherwise)

If FAIL, add one concise paragraph after the verdict explaining the specific problems and what the sub-agent should do differently.

Note: This is iteration ${iteration} of ${maxIterations}. Focus on whether the output is usable as-is.`;
};
