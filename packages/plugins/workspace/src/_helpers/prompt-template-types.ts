// Types for workspace prompt templates — stored on planData, validated by activate tool

export type AgentTier = 'reviewer' | 'worker';

export type PromptTemplate = {
  tier: AgentTier;
  template: string;
};

export type ActivateInput = {
  objective: string;
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    dependsOn?: string[];
    acceptanceCriteria: string;
    agentId?: string;
  }>;
  reviewerTemplate: string;
  workerTemplate: string;
  evalCriteria: string;
};

export type PromptValidationError = {
  field: string;
  message: string;
};

export type PromptValidationResult = { valid: true } | { valid: false; errors: PromptValidationError[] };
