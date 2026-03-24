import { describe, expect, it } from 'vitest';
import { formatProjectToolsSection } from '../format-project-tools-section';

describe('formatProjectToolsSection', () => {
  it('returns tool guidance wrapped in <project_tools> tags when projectId is present', () => {
    const result = formatProjectToolsSection('proj-123');

    expect(result).toContain('<project_tools>');
    expect(result).toContain('</project_tools>');
  });

  it('mentions project memory tools', () => {
    const result = formatProjectToolsSection('proj-123');

    expect(result).toContain('project__get_project_memory');
    expect(result).toContain('project__set_project_memory');
  });

  it('mentions project info tools', () => {
    const result = formatProjectToolsSection('proj-123');

    expect(result).toContain('project__get_project_info');
    expect(result).toContain('project__set_project_instructions');
    expect(result).toContain('project__set_project_description');
  });

  it('mentions task tools', () => {
    const result = formatProjectToolsSection('proj-123');

    expect(result).toContain('tasks__add_task');
    expect(result).toContain('tasks__list_tasks');
    expect(result).toContain('tasks__update_task');
    expect(result).toContain('tasks__complete_task');
  });

  it('includes guidance to prefer tools over file writes', () => {
    const result = formatProjectToolsSection('proj-123');

    expect(result).toMatch(/persist|preserve|store/i);
    expect(result).toMatch(/rather than|instead of|prefer/i);
  });

  it('returns empty string when projectId is null', () => {
    const result = formatProjectToolsSection(null);

    expect(result).toBe('');
  });

  it('returns empty string when projectId is undefined', () => {
    const result = formatProjectToolsSection(undefined);

    expect(result).toBe('');
  });
});
