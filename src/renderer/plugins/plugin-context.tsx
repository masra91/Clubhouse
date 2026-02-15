import React, { createContext, useContext } from 'react';
import type { PluginAPI } from '../../shared/plugin-types';

const PluginAPIContext = createContext<PluginAPI | null>(null);

export function usePluginAPI(): PluginAPI {
  const api = useContext(PluginAPIContext);
  if (!api) {
    throw new Error('usePluginAPI must be used within a <PluginAPIProvider>');
  }
  return api;
}

export function PluginAPIProvider({ api, children }: { api: PluginAPI; children: React.ReactNode }) {
  return (
    <PluginAPIContext.Provider value={api}>
      {children}
    </PluginAPIContext.Provider>
  );
}
