import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Minimal DOM mock for testing style injection
const elements = new Map<string, { id: string; tagName: string; textContent: string; remove: () => void }>();

function createElement(tag: string) {
  const el = {
    id: '',
    tagName: tag.toUpperCase(),
    textContent: '',
    remove: () => { elements.delete(el.id); },
  };
  return el;
}

const mockHead = {
  appendChild: (el: any) => { elements.set(el.id, el); },
};

Object.defineProperty(globalThis, 'document', {
  value: {
    createElement,
    head: mockHead,
    getElementById: (id: string) => elements.get(id) ?? null,
    querySelectorAll: (selector: string) => {
      if (selector.startsWith('#')) {
        const id = selector.slice(1);
        const el = elements.get(id);
        return el ? [el] : [];
      }
      // For the prefix selector style[id^="plugin-styles-"]
      const results: any[] = [];
      for (const [id, el] of elements) {
        if (id.startsWith('plugin-styles-')) results.push(el);
      }
      return results;
    },
  },
  writable: true,
  configurable: true,
});

import { injectStyles, removeStyles } from './plugin-styles';

describe('plugin-styles', () => {
  beforeEach(() => {
    elements.clear();
  });

  afterEach(() => {
    elements.clear();
  });

  describe('injectStyles', () => {
    it('creates a style element', () => {
      injectStyles('test-plugin', 'body { color: red; }');
      const el = document.getElementById('plugin-styles-test-plugin');
      expect(el).not.toBeNull();
      expect(el?.tagName).toBe('STYLE');
      expect(el?.textContent).toBe('body { color: red; }');
    });

    it('replaces existing styles for the same plugin', () => {
      injectStyles('test-plugin', 'body { color: red; }');
      injectStyles('test-plugin', 'body { color: blue; }');
      const matches = document.querySelectorAll('#plugin-styles-test-plugin');
      expect(matches.length).toBe(1);
      expect(matches[0].textContent).toBe('body { color: blue; }');
    });

    it('does not affect other plugins styles', () => {
      injectStyles('plugin-a', '.a { }');
      injectStyles('plugin-b', '.b { }');
      expect(document.getElementById('plugin-styles-plugin-a')?.textContent).toBe('.a { }');
      expect(document.getElementById('plugin-styles-plugin-b')?.textContent).toBe('.b { }');
    });
  });

  describe('removeStyles', () => {
    it('removes the style element for a plugin', () => {
      injectStyles('test-plugin', 'body { }');
      expect(document.getElementById('plugin-styles-test-plugin')).not.toBeNull();
      removeStyles('test-plugin');
      expect(document.getElementById('plugin-styles-test-plugin')).toBeNull();
    });

    it('does nothing if no styles exist for the plugin', () => {
      expect(() => removeStyles('nonexistent')).not.toThrow();
    });

    it('does not affect other plugins', () => {
      injectStyles('plugin-a', '.a { }');
      injectStyles('plugin-b', '.b { }');
      removeStyles('plugin-a');
      expect(document.getElementById('plugin-styles-plugin-a')).toBeNull();
      expect(document.getElementById('plugin-styles-plugin-b')).not.toBeNull();
    });
  });
});
