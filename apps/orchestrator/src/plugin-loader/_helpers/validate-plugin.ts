// Validates that a dynamically imported module exports a valid PluginDefinition

import type { PluginDefinition } from '@harness/plugin-contract';

type ValidationResult = { valid: true; definition: PluginDefinition } | { valid: false; errors: string[] };

type ValidatePluginExport = (moduleExports: Record<string, unknown>, modulePath: string) => ValidationResult;

export const validatePluginExport: ValidatePluginExport = (moduleExports, modulePath) => {
  const errors: string[] = [];

  // Look for a default export or a named `plugin` export
  const candidate = (moduleExports.default as Record<string, unknown> | undefined) ?? (moduleExports.plugin as Record<string, unknown> | undefined);

  if (!candidate || typeof candidate !== 'object') {
    return {
      valid: false,
      errors: [`${modulePath}: No valid plugin export found. Expected a default export or named "plugin" export.`],
    };
  }

  if (typeof candidate.name !== 'string' || candidate.name.trim() === '') {
    errors.push(`${modulePath}: Missing or invalid "name" (expected non-empty string).`);
  }

  if (typeof candidate.version !== 'string' || candidate.version.trim() === '') {
    errors.push(`${modulePath}: Missing or invalid "version" (expected non-empty string).`);
  }

  if (typeof candidate.register !== 'function') {
    errors.push(`${modulePath}: Missing or invalid "register" (expected function).`);
  }

  if (candidate.start !== undefined && typeof candidate.start !== 'function') {
    errors.push(`${modulePath}: Invalid "start" (expected function or undefined).`);
  }

  if (candidate.stop !== undefined && typeof candidate.stop !== 'function') {
    errors.push(`${modulePath}: Invalid "stop" (expected function or undefined).`);
  }

  if (candidate.tools !== undefined) {
    if (!Array.isArray(candidate.tools)) {
      errors.push(`${modulePath}: Invalid "tools" (expected array or undefined).`);
    } else {
      for (let i = 0; i < candidate.tools.length; i++) {
        const t = candidate.tools[i] as Record<string, unknown>;
        if (typeof t.name !== 'string' || t.name.trim() === '') {
          errors.push(`${modulePath}: tools[${i}] missing or invalid "name" (expected non-empty string).`);
        }
        if (typeof t.description !== 'string' || t.description.trim() === '') {
          errors.push(`${modulePath}: tools[${i}] missing or invalid "description" (expected non-empty string).`);
        }
        if (typeof t.handler !== 'function') {
          errors.push(`${modulePath}: tools[${i}] missing or invalid "handler" (expected function).`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, definition: candidate as unknown as PluginDefinition };
};
