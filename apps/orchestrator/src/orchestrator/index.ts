// Orchestrator module — coordinates thread routing, plugin loading, and invocation

export const createOrchestrator = () => {
  // TODO: Wire up thread router, plugin loader, and invoker
  return {
    start: async () => {
      console.log("Orchestrator module initialized");
    },
  };
};
