type DefaultProjectDefinition = {
  id: string;
  name: string;
  description: string;
};

type GetDefaultProjectDefinition = () => DefaultProjectDefinition;

export const getDefaultProjectDefinition: GetDefaultProjectDefinition = () => ({
  id: 'seed_default_project_001',
  name: 'General',
  description: 'Default project for organizing conversations',
});
