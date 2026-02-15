import React from 'react';
import { useUIStore } from '../../stores/uiStore';
import { usePluginStore } from '../../plugins/plugin-store';
import { PluginAPIProvider } from '../../plugins/plugin-context';
import { createPluginAPI } from '../../plugins/plugin-api-factory';
import { getActiveContext } from '../../plugins/plugin-loader';
import { useProjectStore } from '../../stores/projectStore';
import { PluginSettingsRenderer } from '../../plugins/plugin-settings-renderer';

export function PluginDetailSettings() {
  const pluginSettingsId = useUIStore((s) => s.pluginSettingsId);
  const setSettingsSubPage = useUIStore((s) => s.setSettingsSubPage);
  const settingsContext = useUIStore((s) => s.settingsContext);
  const plugins = usePluginStore((s) => s.plugins);
  const modules = usePluginStore((s) => s.modules);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  if (!pluginSettingsId) {
    return (
      <div className="h-full overflow-y-auto bg-ctp-base p-6">
        <p className="text-ctp-subtext0">No plugin selected</p>
      </div>
    );
  }

  const entry = plugins[pluginSettingsId];
  if (!entry) {
    return (
      <div className="h-full overflow-y-auto bg-ctp-base p-6">
        <p className="text-ctp-subtext0">Plugin not found</p>
      </div>
    );
  }

  const closePluginSettings = useUIStore((s) => s.closePluginSettings);
  const goBack = () => {
    closePluginSettings();
  };

  const mod = modules[pluginSettingsId];
  const projectId = settingsContext !== 'app' ? settingsContext : undefined;

  // Determine whether to render declarative or custom settings
  const isDeclarative = entry.manifest.settingsPanel === 'declarative'
    || (!entry.manifest.settingsPanel && entry.manifest.contributes?.settings && entry.manifest.contributes.settings.length > 0);
  const isCustom = entry.manifest.settingsPanel === 'custom' && mod?.SettingsPanel;

  return (
    <div className="h-full overflow-y-auto bg-ctp-base p-6">
      <div className="max-w-2xl">
        {/* Back button */}
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 text-sm text-ctp-subtext0 hover:text-ctp-text mb-4 cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Plugins
        </button>

        <h2 className="text-lg font-semibold text-ctp-text mb-1">{entry.manifest.name} Settings</h2>
        <p className="text-xs text-ctp-subtext0 mb-6">v{entry.manifest.version}</p>

        {isDeclarative && entry.manifest.contributes?.settings && (
          <PluginSettingsRenderer
            pluginId={pluginSettingsId}
            settings={entry.manifest.contributes.settings}
            scope={projectId || 'app'}
          />
        )}

        {isCustom && mod?.SettingsPanel && (() => {
          const ctx = getActiveContext(pluginSettingsId, activeProjectId || undefined);
          if (!ctx) return <p className="text-ctp-subtext0 text-sm">Plugin is not activated</p>;
          const api = createPluginAPI(ctx);
          const SettingsPanel = mod.SettingsPanel!;
          return (
            <PluginAPIProvider api={api}>
              <SettingsPanel api={api} />
            </PluginAPIProvider>
          );
        })()}

        {!isDeclarative && !isCustom && (
          <p className="text-sm text-ctp-subtext0">This plugin has no configurable settings.</p>
        )}
      </div>
    </div>
  );
}
