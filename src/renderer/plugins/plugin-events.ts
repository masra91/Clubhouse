import type { Disposable } from '../../shared/plugin-types';

type Handler = (...args: unknown[]) => void;

class PluginEventBus {
  private listeners = new Map<string, Set<Handler>>();

  on(event: string, handler: Handler): Disposable {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    return {
      dispose: () => {
        this.listeners.get(event)?.delete(handler);
      },
    };
  }

  emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(...args);
      } catch (err) {
        console.error(`[PluginEventBus] Error in handler for "${event}":`, err);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const pluginEventBus = new PluginEventBus();
