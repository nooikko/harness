type ParsedSearchFilters = {
  agent?: string;
  project?: string;
  thread?: string;
  role?: 'user' | 'assistant';
  hasFile?: boolean;
  fileName?: string;
  task?: string;
  before?: Date;
  after?: Date;
};

type ParsedSearchQuery = {
  searchTerms: string;
  filters: ParsedSearchFilters;
};

const FILTER_PATTERNS = {
  agent: /\bagent:(\S+)/i,
  project: /\bproject:(\S+)/i,
  thread: /\bin:(\S+)/i,
  role: /\bfrom:(user|assistant)/i,
  hasFile: /\bhas:file\b/i,
  fileName: /\bfile:(\S+)/i,
  task: /\btask:(\S+)/i,
  before: /\bbefore:(\S+)/i,
  after: /\bafter:(\S+)/i,
} as const;

type ParseSearchFilters = (raw: string) => ParsedSearchQuery;

export const parseSearchFilters: ParseSearchFilters = (raw) => {
  const filters: ParsedSearchFilters = {};
  let remaining = raw;

  const agentMatch = FILTER_PATTERNS.agent.exec(raw);
  if (agentMatch) {
    filters.agent = agentMatch[1];
    remaining = remaining.replace(agentMatch[0], '');
  }
  const projectMatch = FILTER_PATTERNS.project.exec(raw);
  if (projectMatch) {
    filters.project = projectMatch[1];
    remaining = remaining.replace(projectMatch[0], '');
  }
  const threadMatch = FILTER_PATTERNS.thread.exec(raw);
  if (threadMatch) {
    filters.thread = threadMatch[1];
    remaining = remaining.replace(threadMatch[0], '');
  }
  const roleMatch = FILTER_PATTERNS.role.exec(raw);
  if (roleMatch) {
    filters.role = roleMatch[1] as 'user' | 'assistant';
    remaining = remaining.replace(roleMatch[0], '');
  }
  const hasFileMatch = FILTER_PATTERNS.hasFile.exec(raw);
  if (hasFileMatch) {
    filters.hasFile = true;
    remaining = remaining.replace(hasFileMatch[0], '');
  }
  const fileNameMatch = FILTER_PATTERNS.fileName.exec(raw);
  if (fileNameMatch) {
    filters.fileName = fileNameMatch[1];
    remaining = remaining.replace(fileNameMatch[0], '');
  }
  const taskMatch = FILTER_PATTERNS.task.exec(raw);
  if (taskMatch) {
    filters.task = taskMatch[1];
    remaining = remaining.replace(taskMatch[0], '');
  }
  const beforeMatch = FILTER_PATTERNS.before.exec(raw);
  if (beforeMatch) {
    const date = new Date(beforeMatch[1]!);
    if (!Number.isNaN(date.getTime())) {
      filters.before = date;
    }
    remaining = remaining.replace(beforeMatch[0], '');
  }
  const afterMatch = FILTER_PATTERNS.after.exec(raw);
  if (afterMatch) {
    const date = new Date(afterMatch[1]!);
    if (!Number.isNaN(date.getTime())) {
      filters.after = date;
    }
    remaining = remaining.replace(afterMatch[0], '');
  }

  return { searchTerms: remaining.replace(/\s+/g, ' ').trim(), filters };
};

export { FILTER_PATTERNS };
export type { ParsedSearchFilters, ParsedSearchQuery };
