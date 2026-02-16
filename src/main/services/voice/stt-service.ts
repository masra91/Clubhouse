import { transcribe as whisperTranscribe } from '@kutalia/whisper-node-addon';
import { getModelPaths } from './model-manager';

/**
 * Transcribe raw PCM audio using Whisper.
 * Input: Float32Array of 16kHz mono PCM samples.
 * Returns: Transcribed text string.
 */
export async function transcribe(pcmBuffer: Float32Array): Promise<string> {
  if (pcmBuffer.length === 0) {
    return '';
  }

  const paths = getModelPaths();

  try {
    const result = await whisperTranscribe({
      pcmf32: pcmBuffer,
      model: paths.whisper,
      language: 'en',
      use_gpu: true,
      no_prints: true,
      no_timestamps: true,
    });

    // result.transcription is string[] (no_timestamps: true) or string[][] (with timestamps)
    const segments = result.transcription;
    if (!segments || segments.length === 0) {
      return '';
    }

    // With no_timestamps, each entry is a string; join them
    const text = segments
      .map((s) => (Array.isArray(s) ? s[s.length - 1] : s))
      .join(' ')
      .trim();

    return text;
  } catch (err) {
    throw new Error(
      `Whisper transcription failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
