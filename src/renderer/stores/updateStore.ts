import { create } from 'zustand';
import type { UpdateStatus, UpdateSettings } from '../../shared/types';

interface UpdateStoreState {
  status: UpdateStatus;
  settings: UpdateSettings;
  dismissed: boolean;
  loadSettings: () => Promise<void>;
  saveSettings: (settings: UpdateSettings) => Promise<void>;
  checkForUpdates: () => Promise<void>;
  applyUpdate: () => Promise<void>;
  dismiss: () => void;
}

const DEFAULT_STATUS: UpdateStatus = {
  state: 'idle',
  availableVersion: null,
  releaseNotes: null,
  downloadProgress: 0,
  error: null,
  downloadPath: null,
};

const DEFAULT_SETTINGS: UpdateSettings = {
  autoUpdate: true,
  lastCheck: null,
  dismissedVersion: null,
};

export const useUpdateStore = create<UpdateStoreState>((set, get) => ({
  status: DEFAULT_STATUS,
  settings: DEFAULT_SETTINGS,
  dismissed: false,

  loadSettings: async () => {
    try {
      const [settings, status] = await Promise.all([
        window.clubhouse.app.getUpdateSettings(),
        window.clubhouse.app.getUpdateStatus(),
      ]);
      set({
        settings: settings || DEFAULT_SETTINGS,
        status: status || DEFAULT_STATUS,
      });
    } catch {
      // Keep defaults on error
    }
  },

  saveSettings: async (settings: UpdateSettings) => {
    set({ settings });
    try {
      await window.clubhouse.app.saveUpdateSettings(settings);
    } catch {
      // Revert on error
    }
  },

  checkForUpdates: async () => {
    try {
      const status = await window.clubhouse.app.checkForUpdates();
      set({ status, dismissed: false });
    } catch {
      // Error handled in main process
    }
  },

  applyUpdate: async () => {
    try {
      await window.clubhouse.app.applyUpdate();
    } catch {
      // Error handled in main process
    }
  },

  dismiss: () => {
    set({ dismissed: true });
  },
}));

// Listen for status updates from main process
export function initUpdateListener(): () => void {
  return window.clubhouse.app.onUpdateStatusChanged((status) => {
    useUpdateStore.setState({ status: status as UpdateStatus });
    // If a new version becomes ready, un-dismiss so the banner shows
    if (status.state === 'ready') {
      useUpdateStore.setState({ dismissed: false });
    }
  });
}
