import { BrowserWindow, ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { AudioSettings } from '../../shared/types';
import { AudioService } from '../services/audio/audio-service';

let audioService: AudioService | null = null;

export function getAudioService(): AudioService {
  if (!audioService) {
    audioService = new AudioService();
  }
  return audioService;
}

export function registerAudioHandlers(): void {
  const service = getAudioService();

  ipcMain.handle(IPC.AUDIO.GET_SETTINGS, () => {
    return service.getSettings();
  });

  ipcMain.handle(IPC.AUDIO.SAVE_SETTINGS, (_event, settings: AudioSettings) => {
    service.updateSettings(settings);
  });

  ipcMain.on(IPC.AUDIO.RECORDING_DATA, (_event, chunk: Buffer) => {
    service.onRecordingData(chunk);
  });

  ipcMain.handle(IPC.AUDIO.STOP_RECORDING, async (_event, agents: any[], focusedAgentId: string | null) => {
    return service.onRecordingStop(agents, focusedAgentId);
  });

  ipcMain.handle(IPC.AUDIO.SPEAK, async (_event, agentId: string, text: string, kind: string) => {
    const audio = await service.onAgentOutput(agentId, text, kind as any);
    if (audio) {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        win.webContents.send(IPC.AUDIO.SPEAK_AUDIO, audio);
      }
    }
  });

  ipcMain.on(IPC.AUDIO.CANCEL_SPEECH, () => {
    service.cancelSpeech();
  });

  ipcMain.handle(IPC.AUDIO.GET_VOICES, async () => {
    try {
      const tts = service.getActiveTTSEngine();
      return tts.listVoices();
    } catch {
      return [];
    }
  });
}
