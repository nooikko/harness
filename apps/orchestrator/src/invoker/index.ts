// Invoker module — manages Claude CLI process invocations

export const createInvoker = () => {
  // TODO: Spawn claude CLI processes, manage stdin/stdout
  return {
    invoke: async (_prompt: string) => {
      console.log("Invoker: Claude CLI invocation placeholder");
      return { output: "" };
    },
  };
};
