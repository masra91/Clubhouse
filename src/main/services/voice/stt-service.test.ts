import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@kutalia/whisper-node-addon', () => ({
  transcribe: vi.fn(),
}));

vi.mock('./model-manager', () => ({
  getModelPaths: vi.fn(() => ({
    whisper: '/mock/path/ggml-base.en.bin',
    piperBinary: '/mock/path/piper',
    piperVoice: '/mock/path/voice.onnx',
    piperVoiceConfig: '/mock/path/voice.onnx.json',
  })),
}));

import { transcribe } from './stt-service';
import { transcribe as whisperTranscribe } from '@kutalia/whisper-node-addon';

const mockWhisper = vi.mocked(whisperTranscribe);

describe('stt-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty string for empty buffer', async () => {
    const result = await transcribe(new Float32Array(0));
    expect(result).toBe('');
    expect(mockWhisper).not.toHaveBeenCalled();
  });

  it('calls whisper with correct options', async () => {
    mockWhisper.mockResolvedValue({ transcription: ['hello world'] });

    const pcm = new Float32Array([0.1, 0.2, 0.3]);
    await transcribe(pcm);

    expect(mockWhisper).toHaveBeenCalledWith({
      pcmf32: pcm,
      model: '/mock/path/ggml-base.en.bin',
      language: 'en',
      use_gpu: true,
      no_prints: true,
      no_timestamps: true,
    });
  });

  it('returns transcribed text from string segments', async () => {
    mockWhisper.mockResolvedValue({ transcription: ['hello', 'world'] });

    const result = await transcribe(new Float32Array([0.1]));
    expect(result).toBe('hello world');
  });

  it('handles array segments (with timestamps)', async () => {
    mockWhisper.mockResolvedValue({
      transcription: [['00:00:00', 'hello'], ['00:00:01', 'world']],
    });

    const result = await transcribe(new Float32Array([0.1]));
    expect(result).toBe('hello world');
  });

  it('returns empty string when transcription is empty', async () => {
    mockWhisper.mockResolvedValue({ transcription: [] });

    const result = await transcribe(new Float32Array([0.1]));
    expect(result).toBe('');
  });

  it('trims whitespace from result', async () => {
    mockWhisper.mockResolvedValue({ transcription: ['  hello  ', '  world  '] });

    const result = await transcribe(new Float32Array([0.1]));
    expect(result).toBe('hello     world');
  });

  it('wraps whisper errors', async () => {
    mockWhisper.mockRejectedValue(new Error('model not found'));

    await expect(transcribe(new Float32Array([0.1]))).rejects.toThrow(
      'Whisper transcription failed: model not found'
    );
  });
});
