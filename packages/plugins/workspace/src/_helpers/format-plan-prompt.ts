// Formats the workspace plan state for injection into the parent agent's prompt

import type { PlanData, PlanTask } from './plan-types';

type FormatPlanPromptInput = {
  objective: string;
  status: string;
  planData: PlanData;
  maxDepth: number;
  workingDirectory: string | null;
};

type FormatTaskLine = (task: PlanTask) => string;

const formatTaskLine: FormatTaskLine = (task) => {
  const deps = task.dependsOn.length > 0 ? ` (depends on: ${task.dependsOn.join(', ')})` : '';
  const assigned = task.assignedTaskId ? ` [assigned: ${task.assignedTaskId}]` : '';
  const review = task.reviewNotes ? `\n    Review: ${task.reviewNotes}` : '';
  const result = task.result ? `\n    Result: ${task.result.slice(0, 200)}` : '';

  return `  - [${task.status}] ${task.id}: ${task.title}${deps}${assigned}${review}${result}`;
};

type FormatPlanPrompt = (input: FormatPlanPromptInput) => string;

export const formatPlanPrompt: FormatPlanPrompt = ({ objective, status, planData, maxDepth, workingDirectory }) => {
  const tasks = planData.tasks ?? [];
  const completedCount = tasks.filter((t) => t.status === 'accepted').length;
  const totalCount = tasks.length;

  const taskLines = tasks.length > 0 ? tasks.map(formatTaskLine).join('\n') : '  (no tasks yet — create a plan)';

  const readyTasks = tasks.filter(
    (t) => t.status === 'pending' && t.dependsOn.every((dep) => tasks.some((d) => d.id === dep && d.status === 'accepted')),
  );

  const readySection = readyTasks.length > 0 ? `\n## Ready to Delegate\n${readyTasks.map((t) => `  - ${t.id}: ${t.title}`).join('\n')}` : '';

  const cwdSection = workingDirectory
    ? `\n## Working Directory\n${workingDirectory}\nSub-agents will run in this directory with its Claude configuration and hooks.`
    : '\n## Working Directory\nNo working directory linked. Link one in project settings before delegating coding tasks.';

  return `# Workspace Plan

## Objective
${objective}

## Status
${status} — ${completedCount}/${totalCount} tasks done

## Task Graph
${taskLines}
${readySection}
${cwdSection}

## Your Role
You are managing this workspace plan. For each incoming result:
1. Evaluate the quality and completeness against the acceptance criteria
2. Update the plan (call workspace__update_plan)
3. Take the next action:
   - DELEGATE: call delegation__delegate for the next task(s) whose dependencies are met
   - RE-DELEGATE: send rejected work back with specific feedback
   - ESCALATE: call workspace__escalate if you need human input
   - COMPLETE: call workspace__complete_plan when all tasks are accepted

You can spawn reviewer agents who create worktrees and manage worker agents.
Reviewers enforce code quality. Workers write code and commit.
Max delegation depth: ${maxDepth}.`;
};
