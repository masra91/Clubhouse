import { describe, it, expect } from 'vitest';
import { validateManifest, SUPPORTED_API_VERSIONS } from './manifest-validator';

describe('manifest-validator', () => {
  const validManifest = {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    engine: { api: 1 },
    scope: 'project',
  };

  describe('SUPPORTED_API_VERSIONS', () => {
    it('includes version 1', () => {
      expect(SUPPORTED_API_VERSIONS).toContain(1);
    });
  });

  describe('validateManifest', () => {
    it('accepts a valid project-scoped manifest', () => {
      const result = validateManifest(validManifest);
      expect(result.valid).toBe(true);
      expect(result.manifest).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('accepts a valid app-scoped manifest', () => {
      const result = validateManifest({ ...validManifest, scope: 'app' });
      expect(result.valid).toBe(true);
    });

    it('accepts manifest with all optional fields', () => {
      const result = validateManifest({
        ...validManifest,
        description: 'A test plugin',
        author: 'Test Author',
        main: './dist/main.js',
        settingsPanel: 'declarative',
        contributes: {
          tab: { label: 'Test', icon: 'puzzle', layout: 'sidebar-content' },
          commands: [{ id: 'test.run', title: 'Run Test' }],
          settings: [{ key: 'test.opt', type: 'boolean', label: 'Option', default: true }],
        },
      });
      expect(result.valid).toBe(true);
    });

    // --- Required field checks ---

    it('rejects null input', () => {
      const result = validateManifest(null);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('JSON object');
    });

    it('rejects non-object input', () => {
      const result = validateManifest('not an object');
      expect(result.valid).toBe(false);
    });

    it('rejects missing id', () => {
      const { id, ...rest } = validManifest;
      const result = validateManifest(rest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: id');
    });

    it('rejects empty string id', () => {
      const result = validateManifest({ ...validManifest, id: '' });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid id format (uppercase)', () => {
      const result = validateManifest({ ...validManifest, id: 'MyPlugin' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must match');
    });

    it('rejects invalid id format (spaces)', () => {
      const result = validateManifest({ ...validManifest, id: 'my plugin' });
      expect(result.valid).toBe(false);
    });

    it('accepts id with hyphens', () => {
      const result = validateManifest({ ...validManifest, id: 'my-cool-plugin' });
      expect(result.valid).toBe(true);
    });

    it('accepts id with numbers', () => {
      const result = validateManifest({ ...validManifest, id: 'plugin2' });
      expect(result.valid).toBe(true);
    });

    it('rejects missing name', () => {
      const { name, ...rest } = validManifest;
      const result = validateManifest(rest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: name');
    });

    it('rejects missing version', () => {
      const { version, ...rest } = validManifest;
      const result = validateManifest(rest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: version');
    });

    // --- Engine checks ---

    it('rejects missing engine', () => {
      const { engine, ...rest } = validManifest;
      const result = validateManifest(rest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: engine');
    });

    it('rejects non-numeric engine.api', () => {
      const result = validateManifest({ ...validManifest, engine: { api: 'v1' } });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('engine.api must be a number');
    });

    it('rejects unsupported API version', () => {
      const result = validateManifest({ ...validManifest, engine: { api: 99 } });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Unsupported API version');
    });

    // --- Scope checks ---

    it('rejects invalid scope', () => {
      const result = validateManifest({ ...validManifest, scope: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid scope');
    });

    // --- Scope/contributes consistency ---

    it('rejects project-scoped plugin with railItem', () => {
      const result = validateManifest({
        ...validManifest,
        scope: 'project',
        contributes: { railItem: { label: 'Test' } },
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('cannot contribute railItem');
    });

    it('rejects app-scoped plugin with tab', () => {
      const result = validateManifest({
        ...validManifest,
        scope: 'app',
        contributes: { tab: { label: 'Test' } },
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('cannot contribute tab');
    });

    it('collects multiple errors at once', () => {
      const result = validateManifest({
        id: 'INVALID',
        scope: 'bad',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(2);
    });

    it('ignores unknown fields (forward compatibility)', () => {
      const result = validateManifest({
        ...validManifest,
        futureField: 'value',
        experimental: { option: true },
      });
      expect(result.valid).toBe(true);
    });
  });
});
