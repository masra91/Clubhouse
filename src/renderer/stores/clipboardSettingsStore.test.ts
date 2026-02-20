import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useClipboardSettingsStore } from './clipboardSettingsStore';

// Override the default setup-renderer stub with controllable mocks
const mockGetClipboardSettings = vi.fn(async () => ({ clipboardCompat: false }));
const mockSaveClipboardSettings = vi.fn(async () => {});

Object.defineProperty(window, 'clubhouse', {
  configurable: true,
  get: () => ({
    platform: 'darwin',
    app: {
      getClipboardSettings: mockGetClipboardSettings,
      saveClipboardSettings: mockSaveClipboardSettings,
    },
    pty: { write: vi.fn(), resize: vi.fn(), getBuffer: vi.fn(async () => ''), onData: () => vi.fn(), onExit: () => vi.fn() },
  }),
});

describe('clipboardSettingsStore', () => {
  beforeEach(() => {
    mockGetClipboardSettings.mockReset().mockResolvedValue({ clipboardCompat: false });
    mockSaveClipboardSettings.mockReset();
    // Reset store state
    useClipboardSettingsStore.setState({ clipboardCompat: false, loaded: false });
  });

  it('defaults clipboardCompat to false', () => {
    expect(useClipboardSettingsStore.getState().clipboardCompat).toBe(false);
  });

  it('loads settings from main process', async () => {
    mockGetClipboardSettings.mockResolvedValue({ clipboardCompat: true });
    await useClipboardSettingsStore.getState().loadSettings();

    expect(mockGetClipboardSettings).toHaveBeenCalled();
    expect(useClipboardSettingsStore.getState().clipboardCompat).toBe(true);
    expect(useClipboardSettingsStore.getState().loaded).toBe(true);
  });

  it('defaults to false when load returns null', async () => {
    mockGetClipboardSettings.mockResolvedValue(null);
    await useClipboardSettingsStore.getState().loadSettings();

    expect(useClipboardSettingsStore.getState().clipboardCompat).toBe(false);
    expect(useClipboardSettingsStore.getState().loaded).toBe(true);
  });

  it('saves settings to main process', async () => {
    await useClipboardSettingsStore.getState().saveSettings(true);

    expect(useClipboardSettingsStore.getState().clipboardCompat).toBe(true);
    expect(mockSaveClipboardSettings).toHaveBeenCalledWith({ clipboardCompat: true });
  });

  it('reverts on save failure', async () => {
    mockSaveClipboardSettings.mockImplementation(() => { throw new Error('fail'); });
    await useClipboardSettingsStore.getState().saveSettings(true);

    expect(useClipboardSettingsStore.getState().clipboardCompat).toBe(false);
  });
});
