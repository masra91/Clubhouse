import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pluginCommandRegistry } from './plugin-commands';

describe('PluginCommandRegistry', () => {
  beforeEach(() => {
    pluginCommandRegistry.clear();
  });

  it('registers and executes a command', async () => {
    const handler = vi.fn();
    pluginCommandRegistry.register('test.command', handler);
    await pluginCommandRegistry.execute('test.command', 'arg1');
    expect(handler).toHaveBeenCalledWith('arg1');
  });

  it('supports async command handlers', async () => {
    const handler = vi.fn(async () => { /* async work */ });
    pluginCommandRegistry.register('test.async', handler);
    await pluginCommandRegistry.execute('test.async');
    expect(handler).toHaveBeenCalled();
  });

  it('throws when executing an unregistered command', async () => {
    await expect(pluginCommandRegistry.execute('nonexistent')).rejects.toThrow('Command not found');
  });

  it('returns a disposable that unregisters the command', async () => {
    const handler = vi.fn();
    const disposable = pluginCommandRegistry.register('test.command', handler);
    expect(pluginCommandRegistry.has('test.command')).toBe(true);
    disposable.dispose();
    expect(pluginCommandRegistry.has('test.command')).toBe(false);
    await expect(pluginCommandRegistry.execute('test.command')).rejects.toThrow();
  });

  it('has() returns true for registered commands', () => {
    pluginCommandRegistry.register('test.exists', vi.fn());
    expect(pluginCommandRegistry.has('test.exists')).toBe(true);
    expect(pluginCommandRegistry.has('test.nope')).toBe(false);
  });

  it('warns when overwriting an existing command', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    pluginCommandRegistry.register('test.dupe', vi.fn());
    pluginCommandRegistry.register('test.dupe', vi.fn());
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Overwriting'));
    warnSpy.mockRestore();
  });

  it('clear() removes all commands', () => {
    pluginCommandRegistry.register('a', vi.fn());
    pluginCommandRegistry.register('b', vi.fn());
    pluginCommandRegistry.clear();
    expect(pluginCommandRegistry.has('a')).toBe(false);
    expect(pluginCommandRegistry.has('b')).toBe(false);
  });

  it('passes multiple arguments to command handler', async () => {
    const handler = vi.fn();
    pluginCommandRegistry.register('test.multi', handler);
    await pluginCommandRegistry.execute('test.multi', 'a', 42, true);
    expect(handler).toHaveBeenCalledWith('a', 42, true);
  });
});
