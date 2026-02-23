// Thread router — routes incoming messages to the correct thread

export const createThreadRouter = () => {
  // TODO: Resolve thread by source+sourceId, create if needed
  return {
    route: async (_source: string, _sourceId: string) => {
      console.log("ThreadRouter: routing placeholder");
      return null;
    },
  };
};
