import { createSettingsStore } from './settings-store';
import type { ClipboardSettings } from '../../shared/types';

const store = createSettingsStore<ClipboardSettings>('clipboard-settings.json', {
  clipboardCompat: false,
});

export const getSettings = store.get;
export const saveSettings = store.save;
