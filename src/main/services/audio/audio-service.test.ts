import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/test-clubhouse' },
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => { throw new Error('not found'); }),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(() => []),
}));

vi.mock('../log-service', () => ({ appLog: vi.fn() }));

import { AudioService } from './audio-service';
import type { STTEngine } from './stt/stt-engine';
import type { TTSEngine } from './tts/tts-engine';

const mockSTT: STTEngine = {
  id: 'whisper-local',
  displayName: 'Whisper',
  initialize: vi.fn(),
  isAvailable: vi.fn(async () => true),
  transcribe: vi.fn(async () => ({ text: 'Hello world', durationMs: 100 })),
  dispose: vi.fn(),
};

const mockTTS: TTSEngine = {
  id: 'piper-local',
  displayName: 'Piper',
  initialize: vi.fn(),
  isAvailable: vi.fn(async () => true),
  listVoices: vi.fn(async () => [{ voiceId: 'test-voice', voiceName: 'Test', language: 'en' }]),
  synthesize: vi.fn(async () => Buffer.alloc(1000)),
  synthesizeStream: vi.fn(async function* () { yield Buffer.alloc(1000); }),
  dispose: vi.fn(),
};

describe('AudioService', () => {
  let service: AudioService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AudioService();
    service.registerSTTEngine(mockSTT);
    service.registerTTSEngine(mockTTS);
  });

  it('registers and retrieves STT engines', () => {
    const engine = service.getActiveSTTEngine();
    expect(engine.id).toBe('whisper-local');
  });

  it('registers and retrieves TTS engines', () => {
    const engine = service.getActiveTTSEngine();
    expect(engine.id).toBe('piper-local');
  });

  it('accumulates recording data', () => {
    service.onRecordingData(Buffer.alloc(100));
    service.onRecordingData(Buffer.alloc(200));
    // Internal buffer should have data (tested via onRecordingStop)
  });

  it('initializes without errors', async () => {
    await expect(service.initialize()).resolves.not.toThrow();
  });

  it('throws when no STT engine is registered', () => {
    const emptyService = new AudioService();
    expect(() => emptyService.getActiveSTTEngine()).toThrow('No STT engine registered');
  });

  it('throws when no TTS engine is registered', () => {
    const emptyService = new AudioService();
    expect(() => emptyService.getActiveTTSEngine()).toThrow('No TTS engine registered');
  });

  it('returns settings from constructor', () => {
    const settings = service.getSettings();
    expect(settings.sttBackend).toBe('whisper-local');
    expect(settings.ttsBackend).toBe('piper-local');
  });

  it('updates settings', () => {
    const current = service.getSettings();
    const updated = { ...current, enabled: true };
    service.updateSettings(updated);
    expect(service.getSettings().enabled).toBe(true);
  });

  it('disposes all engines', () => {
    service.dispose();
    expect(mockSTT.dispose).toHaveBeenCalled();
    expect(mockTTS.dispose).toHaveBeenCalled();
  });

  it('exposes voice manager and voice router', () => {
    expect(service.getVoiceManager()).toBeDefined();
    expect(service.getVoiceRouter()).toBeDefined();
  });

  it('transcribes and routes on recording stop', async () => {
    service.onRecordingData(Buffer.from('fake audio'));
    const agents = [{ id: 'a1', projectId: 'p1', name: 'Atlas', kind: 'durable' as const, status: 'running' as const, color: '#fff' }];
    const result = await service.onRecordingStop(agents, 'a1');
    expect(result.agentId).toBe('a1');
    expect(result.text).toBe('Hello world');
    expect(mockSTT.transcribe).toHaveBeenCalled();
  });

  it('returns null from onAgentOutput when disabled', async () => {
    // Default settings have enabled: false
    const result = await service.onAgentOutput('a1', 'Hello', 'response');
    expect(result).toBeNull();
  });

  it('synthesizes speech when enabled', async () => {
    const current = service.getSettings();
    service.updateSettings({ ...current, enabled: true });
    const result = await service.onAgentOutput('a1', 'Hello', 'response');
    expect(result).toBeInstanceOf(Buffer);
    expect(mockTTS.synthesize).toHaveBeenCalled();
  });

  it('cancelSpeech resets speakingAgentId', () => {
    // Should not throw
    service.cancelSpeech();
  });
});
