// Validates prompt templates for workspace agent tiers
// Rejects reviewer templates that contain implementation code
// Rejects worker templates that are too vague

import type { PromptTemplate, PromptValidationResult } from './prompt-template-types';

// Patterns that indicate implementation code in a reviewer template
const CODE_BLOCK_PATTERN = /```[\s\S]*?```/;
const ARROW_FN_PATTERN = /const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/;
const FUNCTION_DECL_PATTERN = /function\s+\w+\s*\(/;

const MIN_WORKER_TEMPLATE_LENGTH = 30;

type ValidatePromptTemplate = (input: PromptTemplate) => PromptValidationResult;

export const validatePromptTemplate: ValidatePromptTemplate = (input) => {
  const { tier, template } = input;
  const fieldName = `${tier}Template`;

  if (!template.trim()) {
    return {
      valid: false,
      errors: [{ field: fieldName, message: 'Template cannot be empty' }],
    };
  }

  if (tier === 'reviewer') {
    if (CODE_BLOCK_PATTERN.test(template)) {
      return {
        valid: false,
        errors: [
          {
            field: fieldName,
            message: 'Reviewer template contains code blocks. Reviewers should not receive implementation code — leave that to worker agents.',
          },
        ],
      };
    }

    if (ARROW_FN_PATTERN.test(template) || FUNCTION_DECL_PATTERN.test(template)) {
      return {
        valid: false,
        errors: [
          {
            field: fieldName,
            message: "Reviewer template contains implementation code (function declarations). Reviewers review code, they don't implement it.",
          },
        ],
      };
    }
  }

  if (tier === 'worker') {
    if (template.trim().length < MIN_WORKER_TEMPLATE_LENGTH) {
      return {
        valid: false,
        errors: [
          {
            field: fieldName,
            message: `Worker template is too short (${template.trim().length} chars). Be specific about what the worker should do.`,
          },
        ],
      };
    }
  }

  return { valid: true };
};
