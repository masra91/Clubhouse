import { LoggingSettings } from '../../shared/types';
import { createSettingsStore } from './settings-store';

const store = createSettingsStore<LoggingSettings>('logging-settings.json', {
  enabled: true,
  namespaces: {},
});

export const getSettings = store.get;
export const saveSettings = store.save;
