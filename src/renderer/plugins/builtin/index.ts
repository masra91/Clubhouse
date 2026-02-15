import type { PluginManifest, PluginModule } from '../../../shared/plugin-types';

export interface BuiltinPlugin {
  manifest: PluginManifest;
  module: PluginModule;
}

export function getBuiltinPlugins(): BuiltinPlugin[] {
  return [
    // Built-in plugins registered here
  ];
}
