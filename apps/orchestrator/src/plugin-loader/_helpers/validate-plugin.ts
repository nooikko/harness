// Validates that a dynamically imported module exports a valid PluginDefinition

import type { PluginDefinition } from "@/plugin-contract";

type ValidationResult =
  | { valid: true; definition: PluginDefinition }
  | { valid: false; errors: string[] };

type ValidatePluginExport = (
  moduleExports: Record<string, unknown>,
  modulePath: string
) => ValidationResult;

export const validatePluginExport: ValidatePluginExport = (
  moduleExports,
  modulePath
) => {
  const errors: string[] = [];

  // Look for a default export or a named `plugin` export
  const candidate =
    (moduleExports.default as Record<string, unknown> | undefined) ??
    (moduleExports.plugin as Record<string, unknown> | undefined);

  if (!candidate || typeof candidate !== "object") {
    return {
      valid: false,
      errors: [
        `${modulePath}: No valid plugin export found. Expected a default export or named "plugin" export.`,
      ],
    };
  }

  if (typeof candidate.name !== "string" || candidate.name.trim() === "") {
    errors.push(
      `${modulePath}: Missing or invalid "name" (expected non-empty string).`
    );
  }

  if (
    typeof candidate.version !== "string" ||
    candidate.version.trim() === ""
  ) {
    errors.push(
      `${modulePath}: Missing or invalid "version" (expected non-empty string).`
    );
  }

  if (typeof candidate.register !== "function") {
    errors.push(
      `${modulePath}: Missing or invalid "register" (expected function).`
    );
  }

  if (candidate.start !== undefined && typeof candidate.start !== "function") {
    errors.push(
      `${modulePath}: Invalid "start" (expected function or undefined).`
    );
  }

  if (candidate.stop !== undefined && typeof candidate.stop !== "function") {
    errors.push(
      `${modulePath}: Invalid "stop" (expected function or undefined).`
    );
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, definition: candidate as unknown as PluginDefinition };
};
