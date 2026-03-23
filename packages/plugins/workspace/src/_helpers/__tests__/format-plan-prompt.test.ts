import { describe, expect, it } from 'vitest';
import { formatPlanPrompt } from '../format-plan-prompt';
import type { PlanData } from '../plan-types';

describe('formatPlanPrompt', () => {
  const basePlan = {
    objective: 'Get comprehensive test coverage',
    status: 'active',
    maxDepth: 3,
    workingDirectory: '/Users/quinn/dev/some-project',
  };

  it('formats a plan with tasks showing progress', () => {
    const planData: PlanData = {
      tasks: [
        {
          id: 't1',
          title: 'Unit tests for delegation',
          description: 'Cover all helpers',
          status: 'accepted',
          dependsOn: [],
          acceptanceCriteria: '80%+ coverage',
          assignedTaskId: 'task-1',
          assignedThreadId: 'thread-1',
          result: 'All tests passing, 92% coverage',
          reviewNotes: null,
          depth: 0,
        },
        {
          id: 't2',
          title: 'Integration tests',
          description: 'Full pipeline tests',
          status: 'delegated',
          dependsOn: ['t1'],
          acceptanceCriteria: 'All endpoints covered',
          assignedTaskId: 'task-2',
          assignedThreadId: null,
          result: null,
          reviewNotes: null,
          depth: 0,
        },
        {
          id: 't3',
          title: 'E2E test plan',
          description: 'Plan Playwright tests',
          status: 'pending',
          dependsOn: [],
          acceptanceCriteria: 'Comprehensive plan',
          assignedTaskId: null,
          assignedThreadId: null,
          result: null,
          reviewNotes: null,
          depth: 0,
        },
      ],
    };

    const result = formatPlanPrompt({ ...basePlan, planData });

    expect(result).toContain('# Workspace Plan');
    expect(result).toContain('Get comprehensive test coverage');
    expect(result).toContain('1/3 tasks done');
    expect(result).toContain('[accepted] t1: Unit tests for delegation');
    expect(result).toContain('[delegated] t2: Integration tests');
    expect(result).toContain('(depends on: t1)');
    expect(result).toContain('[pending] t3: E2E test plan');
    expect(result).toContain('## Ready to Delegate');
    expect(result).toContain('t3: E2E test plan');
    expect(result).toContain('/Users/quinn/dev/some-project');
  });

  it('shows empty task graph when no tasks exist', () => {
    const planData: PlanData = { tasks: [] };

    const result = formatPlanPrompt({ ...basePlan, planData });

    expect(result).toContain('0/0 tasks done');
    expect(result).toContain('(no tasks yet');
  });

  it('does not show ready section when no tasks are ready', () => {
    const planData: PlanData = {
      tasks: [
        {
          id: 't1',
          title: 'Task A',
          description: '',
          status: 'delegated',
          dependsOn: [],
          acceptanceCriteria: '',
          assignedTaskId: null,
          assignedThreadId: null,
          result: null,
          reviewNotes: null,
          depth: 0,
        },
      ],
    };

    const result = formatPlanPrompt({ ...basePlan, planData });

    expect(result).not.toContain('## Ready to Delegate');
  });

  it('shows warning when no working directory is linked', () => {
    const planData: PlanData = { tasks: [] };

    const result = formatPlanPrompt({
      ...basePlan,
      planData,
      workingDirectory: null,
    });

    expect(result).toContain('No working directory linked');
  });

  it('includes review notes in task lines', () => {
    const planData: PlanData = {
      tasks: [
        {
          id: 't1',
          title: 'Task A',
          description: '',
          status: 'rejected',
          dependsOn: [],
          acceptanceCriteria: '',
          assignedTaskId: null,
          assignedThreadId: null,
          result: null,
          reviewNotes: 'Missing error handling tests',
          depth: 0,
        },
      ],
    };

    const result = formatPlanPrompt({ ...basePlan, planData });

    expect(result).toContain('Review: Missing error handling tests');
  });

  it('only marks tasks as ready when all dependencies are accepted', () => {
    const planData: PlanData = {
      tasks: [
        {
          id: 't1',
          title: 'Dep task',
          description: '',
          status: 'delegated',
          dependsOn: [],
          acceptanceCriteria: '',
          assignedTaskId: null,
          assignedThreadId: null,
          result: null,
          reviewNotes: null,
          depth: 0,
        },
        {
          id: 't2',
          title: 'Blocked task',
          description: '',
          status: 'pending',
          dependsOn: ['t1'],
          acceptanceCriteria: '',
          assignedTaskId: null,
          assignedThreadId: null,
          result: null,
          reviewNotes: null,
          depth: 0,
        },
      ],
    };

    const result = formatPlanPrompt({ ...basePlan, planData });

    // t2 is pending but its dependency t1 is not accepted, so it shouldn't be in ready section
    expect(result).not.toContain('## Ready to Delegate');
  });

  it('includes max depth in role instructions', () => {
    const planData: PlanData = { tasks: [] };

    const result = formatPlanPrompt({
      ...basePlan,
      planData,
      maxDepth: 5,
    });

    expect(result).toContain('Max delegation depth: 5');
  });
});
