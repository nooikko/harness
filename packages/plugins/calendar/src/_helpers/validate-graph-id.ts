const GRAPH_ID_PATTERN = /^[A-Za-z0-9+/=_-]+$/;

type ValidateGraphId = (id: string, label: string) => string;

const validateGraphId: ValidateGraphId = (id, label) => {
  if (!id || !GRAPH_ID_PATTERN.test(id) || id.includes('..')) {
    throw new Error(`Invalid ${label}: contains disallowed characters`);
  }
  return id;
};

export { validateGraphId };
