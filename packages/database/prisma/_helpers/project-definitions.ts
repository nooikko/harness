type ProjectDefinition = {
  id: string;
  name: string;
  description: string;
};

type GetProjectDefinitions = () => ProjectDefinition[];

export const getProjectDefinitions: GetProjectDefinitions = () => [
  {
    id: 'seed_default_project_001',
    name: 'General',
    description: 'Default project for organizing conversations',
  },
  {
    id: 'seed_code_project_001',
    name: 'Code',
    description: 'Software development projects — architecture, implementation, and code review',
  },
  {
    id: 'seed_health_project_001',
    name: 'Health',
    description: 'Health tracking, blood work analysis, and routine optimization',
  },
];
