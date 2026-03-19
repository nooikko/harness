import { describe, expect, it } from 'vitest';
import { buildRubricPrompt } from '../build-rubric-prompt';

describe('buildRubricPrompt', () => {
  const baseParams = {
    taskPrompt: 'Write a summary of the quarterly earnings report.',
    result: 'The earnings report shows a 15% revenue increase.',
    iteration: 1,
    maxIterations: 3,
  };

  it('interpolates iteration and maxIterations into the prompt', () => {
    const prompt = buildRubricPrompt({
      ...baseParams,
      iteration: 2,
      maxIterations: 5,
    });
    expect(prompt).toContain('iteration 2 of 5');
  });

  it('uses default rubric when customRubric is undefined', () => {
    const prompt = buildRubricPrompt(baseParams);
    expect(prompt).toContain('Q1.');
    expect(prompt).toContain('Q2.');
    expect(prompt).toContain('Q3.');
    expect(prompt).toContain('Q4.');
  });

  it('uses default rubric when customRubric is empty string', () => {
    const prompt = buildRubricPrompt({ ...baseParams, customRubric: '' });
    expect(prompt).toContain('Q1.');
  });

  it('uses custom rubric and omits default when customRubric is provided', () => {
    const customRubric = 'Is the code well-tested?\nIs the architecture sound?';
    const prompt = buildRubricPrompt({ ...baseParams, customRubric });

    expect(prompt).toContain(customRubric);
    expect(prompt).not.toContain('Q1.');
    expect(prompt).not.toContain('Q2.');
  });

  it('places task prompt in Original Task section and result in Sub-Agent Output section', () => {
    const prompt = buildRubricPrompt(baseParams);
    const taskIndex = prompt.indexOf('## Original Task');
    const resultIndex = prompt.indexOf('## Sub-Agent Output');
    const rubricIndex = prompt.indexOf('## Review Rubric');

    // Structural ordering: task before result before rubric
    expect(taskIndex).toBeLessThan(resultIndex);
    expect(resultIndex).toBeLessThan(rubricIndex);

    // Task prompt appears between Original Task and Sub-Agent Output
    const taskSection = prompt.slice(taskIndex, resultIndex);
    expect(taskSection).toContain(baseParams.taskPrompt);

    // Result appears between Sub-Agent Output and Review Rubric
    const resultSection = prompt.slice(resultIndex, rubricIndex);
    expect(resultSection).toContain(baseParams.result);
  });
});
