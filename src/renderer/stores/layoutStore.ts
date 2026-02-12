import { create } from 'zustand';

// Explorer pane constraints
export const EXPLORER_DEFAULT = 200;
export const EXPLORER_MIN = 140;
export const EXPLORER_MAX = 400;

// Accessory pane constraints
export const ACCESSORY_DEFAULT = 280;
export const ACCESSORY_MIN = 180;
export const ACCESSORY_MAX = 500;

// Fixed widths
export const PROJECT_RAIL_WIDTH = 60;
export const COLLAPSED_STRIP_WIDTH = 36;

// Hub pane minimum
export const HUB_PANE_MIN_PX = 120;

const STORAGE_KEY = 'clubhouse_layout';

interface LayoutState {
  explorerWidth: number;
  accessoryWidth: number;
  explorerCollapsed: boolean;
  accessoryCollapsed: boolean;
  hubSplitRatios: Record<string, number>;

  setExplorerWidth: (width: number) => void;
  setAccessoryWidth: (width: number) => void;
  setExplorerCollapsed: (collapsed: boolean) => void;
  setAccessoryCollapsed: (collapsed: boolean) => void;
  toggleExplorerCollapsed: () => void;
  toggleAccessoryCollapsed: () => void;
  setHubSplitRatio: (nodeId: string, ratio: number) => void;
  removeHubSplitRatio: (nodeId: string) => void;
}

interface PersistedLayout {
  explorerWidth: number;
  accessoryWidth: number;
  explorerCollapsed: boolean;
  accessoryCollapsed: boolean;
  hubSplitRatios: Record<string, number>;
}

function loadFromStorage(): Partial<PersistedLayout> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PersistedLayout;
  } catch {
    return {};
  }
}

function saveToStorage(state: PersistedLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota errors
  }
}

function persist(state: LayoutState): void {
  saveToStorage({
    explorerWidth: state.explorerWidth,
    accessoryWidth: state.accessoryWidth,
    explorerCollapsed: state.explorerCollapsed,
    accessoryCollapsed: state.accessoryCollapsed,
    hubSplitRatios: state.hubSplitRatios,
  });
}

const saved = loadFromStorage();

export const useLayoutStore = create<LayoutState>((set, get) => ({
  explorerWidth: saved.explorerWidth ?? EXPLORER_DEFAULT,
  accessoryWidth: saved.accessoryWidth ?? ACCESSORY_DEFAULT,
  explorerCollapsed: saved.explorerCollapsed ?? false,
  accessoryCollapsed: saved.accessoryCollapsed ?? false,
  hubSplitRatios: saved.hubSplitRatios ?? {},

  setExplorerWidth: (width) => {
    const clamped = Math.round(Math.min(EXPLORER_MAX, Math.max(EXPLORER_MIN, width)));
    set({ explorerWidth: clamped });
    persist(get());
  },

  setAccessoryWidth: (width) => {
    const clamped = Math.round(Math.min(ACCESSORY_MAX, Math.max(ACCESSORY_MIN, width)));
    set({ accessoryWidth: clamped });
    persist(get());
  },

  setExplorerCollapsed: (collapsed) => {
    set({ explorerCollapsed: collapsed });
    persist(get());
  },

  setAccessoryCollapsed: (collapsed) => {
    set({ accessoryCollapsed: collapsed });
    persist(get());
  },

  toggleExplorerCollapsed: () => {
    set((s) => ({ explorerCollapsed: !s.explorerCollapsed }));
    persist(get());
  },

  toggleAccessoryCollapsed: () => {
    set((s) => ({ accessoryCollapsed: !s.accessoryCollapsed }));
    persist(get());
  },

  setHubSplitRatio: (nodeId, ratio) => {
    const clamped = Math.min(0.95, Math.max(0.05, ratio));
    set((s) => ({ hubSplitRatios: { ...s.hubSplitRatios, [nodeId]: clamped } }));
    persist(get());
  },

  removeHubSplitRatio: (nodeId) => {
    set((s) => {
      const { [nodeId]: _, ...rest } = s.hubSplitRatios;
      return { hubSplitRatios: rest };
    });
    persist(get());
  },
}));
