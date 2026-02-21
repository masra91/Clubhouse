import { create } from 'zustand';
import { AudioSettings, VoiceConfig, VoiceInfo } from '../../shared/types';

interface AudioState {
  settings: AudioSettings | null;
  recording: boolean;
  transcribing: boolean;
  speaking: boolean;
  speakingAgentId: string | null;
  availableVoices: VoiceInfo[];
  /** Populated by VoiceSelector (Task 13) for per-agent voice overrides. */
  agentVoiceAssignments: Record<string, VoiceConfig>;

  loadSettings: () => Promise<void>;
  saveSettings: (partial: Partial<AudioSettings>) => Promise<void>;
  setRecording: (recording: boolean) => void;
  setTranscribing: (transcribing: boolean) => void;
  setSpeaking: (speaking: boolean, agentId?: string) => void;
  loadVoices: () => Promise<void>;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  settings: null,
  recording: false,
  transcribing: false,
  speaking: false,
  speakingAgentId: null,
  availableVoices: [],
  agentVoiceAssignments: {},

  loadSettings: async () => {
    try {
      const settings = await window.clubhouse.audio.getSettings();
      set({ settings });
    } catch {
      // IPC failure; keep current state
    }
  },

  saveSettings: async (partial) => {
    const current = get().settings;
    if (!current) return;
    const merged = { ...current, ...partial };
    set({ settings: merged });
    try {
      await window.clubhouse.audio.saveSettings(merged);
    } catch {
      set({ settings: current }); // rollback on failure
    }
  },

  setRecording: (recording) => set({ recording }),
  setTranscribing: (transcribing) => set({ transcribing }),

  setSpeaking: (speaking, agentId) =>
    set({ speaking, speakingAgentId: speaking ? (agentId ?? null) : null }),

  loadVoices: async () => {
    try {
      const voices = await window.clubhouse.audio.getVoices();
      set({ availableVoices: voices });
    } catch {
      // IPC failure; keep current voices list
    }
  },
}));
