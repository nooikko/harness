// Plugin loader — discovers and loads plugins at startup

export const createPluginLoader = () => {
  // TODO: Scan plugins directory, validate contracts, register
  return {
    loadAll: async () => {
      console.log("PluginLoader: loading placeholder");
      return [];
    },
  };
};
