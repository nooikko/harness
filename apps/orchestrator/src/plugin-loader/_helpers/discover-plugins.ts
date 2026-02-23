// Discovers plugin directories by scanning a base plugins directory

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

type DiscoverPlugins = (pluginsDir: string) => Promise<string[]>;

export const discoverPlugins: DiscoverPlugins = async (pluginsDir) => {
  let entries: string[];
  try {
    entries = await readdir(pluginsDir);
  } catch {
    return [];
  }

  const pluginPaths: string[] = [];

  for (const entry of entries) {
    // Skip hidden directories and non-directory entries
    if (entry.startsWith(".") || entry.startsWith("_")) {
      continue;
    }

    const entryPath = join(pluginsDir, entry);
    const entryStat = await stat(entryPath);

    if (!entryStat.isDirectory()) {
      continue;
    }

    // Check for index.ts or index.js in the plugin directory
    const indexTsPath = join(entryPath, "index.ts");
    const indexJsPath = join(entryPath, "index.js");

    try {
      await stat(indexTsPath);
      pluginPaths.push(indexTsPath);
      continue;
    } catch {
      // index.ts not found, try index.js
    }

    try {
      await stat(indexJsPath);
      pluginPaths.push(indexJsPath);
    } catch {
      // Neither index.ts nor index.js found, skip this directory
    }
  }

  return pluginPaths;
};
