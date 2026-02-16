import type { Disposable } from '../../shared/plugin-types';

type CommandHandler = (...args: unknown[]) => void | Promise<void>;

class PluginCommandRegistry {
  private commands = new Map<string, CommandHandler>();

  register(commandId: string, handler: CommandHandler): Disposable {
    if (this.commands.has(commandId)) {
      console.warn(`[PluginCommands] Overwriting existing command: ${commandId}`);
    }
    this.commands.set(commandId, handler);
    return {
      dispose: () => {
        this.commands.delete(commandId);
      },
    };
  }

  async execute(commandId: string, ...args: unknown[]): Promise<void> {
    const handler = this.commands.get(commandId);
    if (!handler) {
      throw new Error(`Command not found: ${commandId}`);
    }
    await handler(...args);
  }

  has(commandId: string): boolean {
    return this.commands.has(commandId);
  }

  clear(): void {
    this.commands.clear();
  }
}

export const pluginCommandRegistry = new PluginCommandRegistry();
