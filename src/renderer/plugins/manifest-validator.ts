import type { PluginManifest } from '../../shared/plugin-types';

export const SUPPORTED_API_VERSIONS = [1];

const PLUGIN_ID_REGEX = /^[a-z0-9-]+$/;

interface ValidationResult {
  valid: boolean;
  manifest?: PluginManifest;
  errors: string[];
}

export function validateManifest(raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Manifest must be a JSON object'] };
  }

  const m = raw as Record<string, unknown>;

  // Required fields
  if (typeof m.id !== 'string' || !m.id) {
    errors.push('Missing required field: id');
  } else if (!PLUGIN_ID_REGEX.test(m.id)) {
    errors.push(`Invalid plugin id "${m.id}": must match /^[a-z0-9-]+$/`);
  }

  if (typeof m.name !== 'string' || !m.name) {
    errors.push('Missing required field: name');
  }

  if (typeof m.version !== 'string' || !m.version) {
    errors.push('Missing required field: version');
  }

  // Engine check
  if (!m.engine || typeof m.engine !== 'object') {
    errors.push('Missing required field: engine');
  } else {
    const engine = m.engine as Record<string, unknown>;
    if (typeof engine.api !== 'number') {
      errors.push('engine.api must be a number');
    } else if (!SUPPORTED_API_VERSIONS.includes(engine.api)) {
      errors.push(`Unsupported API version: ${engine.api}. Supported: ${SUPPORTED_API_VERSIONS.join(', ')}`);
    }
  }

  // Scope check
  if (m.scope !== 'project' && m.scope !== 'app') {
    errors.push(`Invalid scope: "${String(m.scope)}". Must be "project" or "app"`);
  }

  // Scope/contributes consistency
  if (m.contributes && typeof m.contributes === 'object') {
    const contrib = m.contributes as Record<string, unknown>;
    if (m.scope === 'project' && contrib.railItem) {
      errors.push('Project-scoped plugins cannot contribute railItem (use tab instead)');
    }
    if (m.scope === 'app' && contrib.tab) {
      errors.push('App-scoped plugins cannot contribute tab (use railItem instead)');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    manifest: raw as PluginManifest,
    errors: [],
  };
}
