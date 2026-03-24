// Formats a guidance section for project-scoped MCP tools.
// Only emitted when the thread belongs to a project.

type FormatProjectToolsSection = (projectId: string | null | undefined) => string;

export const formatProjectToolsSection: FormatProjectToolsSection = (projectId) => {
  if (!projectId) {
    return '';
  }

  return `<project_tools>
You have project management tools available:

Project context:
- project__get_project_info — read project name, description, instructions, and working directory
- project__get_project_memory — read the project memory document
- project__set_project_memory — update project memory with observations and decisions
- project__set_project_instructions — update the instructions injected into every prompt
- project__set_project_description — update the project description

Task tracking:
- tasks__add_task — create a task (auto-scoped to this project)
- tasks__list_tasks — list project tasks by status
- tasks__update_task — update task details
- tasks__complete_task — mark a task done

Use project memory to persist observations and context rather than writing to files. Use tasks to track work items rather than TODO comments in code. Use set_project_instructions to evolve how you approach this project over time.
</project_tools>`;
};
