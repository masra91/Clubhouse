import React from 'react';
import { usePluginStore } from '../plugins/plugin-store';
import { PluginAPIProvider } from '../plugins/plugin-context';
import { createPluginAPI } from '../plugins/plugin-api-factory';
import { getActiveContext } from '../plugins/plugin-loader';
import { useProjectStore } from '../stores/projectStore';

class PluginErrorBoundary extends React.Component<
  { pluginId: string; children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { pluginId: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error(`[Plugin: ${this.props.pluginId}] Render error:`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full bg-ctp-base">
          <div className="text-center text-ctp-subtext0 max-w-md">
            <p className="text-lg mb-2">Plugin Error</p>
            <p className="text-sm mb-4">
              The plugin &quot;{this.props.pluginId}&quot; encountered an error while rendering.
            </p>
            <pre className="text-xs text-left bg-surface-0 p-3 rounded overflow-auto max-h-32">
              {this.state.error?.message}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function PluginContentView({ pluginId }: { pluginId: string }) {
  const modules = usePluginStore((s) => s.modules);
  const plugins = usePluginStore((s) => s.plugins);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  const mod = modules[pluginId];
  const entry = plugins[pluginId];

  if (!mod || !mod.MainPanel) {
    return (
      <div className="flex items-center justify-center h-full bg-ctp-base">
        <div className="text-center text-ctp-subtext0">
          <p className="text-lg mb-2">Plugin Not Available</p>
          <p className="text-sm">
            {entry ? `Plugin "${entry.manifest.name}" has no main panel.` : `Plugin "${pluginId}" is not loaded.`}
          </p>
        </div>
      </div>
    );
  }

  const ctx = getActiveContext(pluginId, activeProjectId || undefined);
  if (!ctx) {
    return (
      <div className="flex items-center justify-center h-full bg-ctp-base">
        <p className="text-ctp-subtext0">Plugin is not activated</p>
      </div>
    );
  }

  const api = createPluginAPI(ctx);
  const MainPanel = mod.MainPanel;

  return (
    <PluginErrorBoundary pluginId={pluginId}>
      <PluginAPIProvider api={api}>
        <div className="h-full bg-ctp-base overflow-auto">
          <MainPanel api={api} />
        </div>
      </PluginAPIProvider>
    </PluginErrorBoundary>
  );
}
