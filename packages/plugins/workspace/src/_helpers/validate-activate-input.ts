// Validates the full activate tool input — objective, tasks, templates, eval criteria

import type { ActivateInput, PromptValidationError, PromptValidationResult } from './prompt-template-types';
import { validatePromptTemplate } from './validate-prompt-template';

// Vague eval criteria patterns — these are too generic to be useful
const VAGUE_PATTERNS = [
  /^make it (good|better|nice|work)\.?$/i,
  /^looks? (good|ok|fine)\.?$/i,
  /^just (do|make) it\.?$/i,
  /^(ok|okay|sure|yes)\.?$/i,
];

const MIN_EVAL_CRITERIA_LENGTH = 20;

type ValidateActivateInput = (input: ActivateInput) => PromptValidationResult;

export const validateActivateInput: ValidateActivateInput = (input) => {
  const errors: PromptValidationError[] = [];

  // Objective
  if (!input.objective?.trim()) {
    errors.push({ field: 'objective', message: 'Objective cannot be empty' });
  }

  // Tasks
  if (!input.tasks || input.tasks.length === 0) {
    errors.push({
      field: 'tasks',
      message: 'At least one task is required',
    });
  } else {
    // Duplicate IDs
    const ids = input.tasks.map((t) => t.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length > 0) {
      errors.push({
        field: 'tasks',
        message: `Tasks have duplicate IDs: ${[...new Set(dupes)].join(', ')}`,
      });
    }

    // Unresolvable dependencies
    const idSet = new Set(ids);
    for (const task of input.tasks) {
      for (const dep of task.dependsOn ?? []) {
        if (!idSet.has(dep)) {
          errors.push({
            field: 'tasks',
            message: `Task "${task.id}" depends on "${dep}" which does not exist`,
          });
        }
      }
    }
  }

  // Reviewer template
  const reviewerResult = validatePromptTemplate({
    tier: 'reviewer',
    template: input.reviewerTemplate,
  });
  if (!reviewerResult.valid) {
    errors.push(...reviewerResult.errors);
  }

  // Worker template
  const workerResult = validatePromptTemplate({
    tier: 'worker',
    template: input.workerTemplate,
  });
  if (!workerResult.valid) {
    errors.push(...workerResult.errors);
  }

  // Eval criteria
  if (!input.evalCriteria?.trim()) {
    errors.push({
      field: 'evalCriteria',
      message: 'Evaluation criteria cannot be empty',
    });
  } else if (input.evalCriteria.trim().length < MIN_EVAL_CRITERIA_LENGTH) {
    errors.push({
      field: 'evalCriteria',
      message: `Evaluation criteria is too short (${input.evalCriteria.trim().length} chars). Be specific about what "done" looks like.`,
    });
  } else if (VAGUE_PATTERNS.some((p) => p.test(input.evalCriteria.trim()))) {
    errors.push({
      field: 'evalCriteria',
      message: 'Evaluation criteria is too vague. Be specific about acceptance thresholds, required test coverage, architectural constraints, etc.',
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
};
