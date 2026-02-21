import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('electron', () => {
  const mockWin = {
    id: 1,
    isDestroyed: () => false,
    webContents: { getURL: () => 'http://localhost:3000' },
  };

  return {
    BrowserWindow: {
      getFocusedWindow: vi.fn(() => mockWin),
      getAllWindows: () => [mockWin],
    },
    dialog: {
      showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] as string[] })),
    },
    ipcMain: {
      handle: vi.fn(),
    },
  };
});

vi.mock('../services/project-store', () => ({
  list: vi.fn(() => []),
  add: vi.fn((dirPath: string) => ({ id: 'proj_1', name: 'test', path: dirPath })),
  remove: vi.fn(),
  update: vi.fn(),
  reorder: vi.fn(),
  setIcon: vi.fn(),
  readIconData: vi.fn(),
  saveCroppedIcon: vi.fn(),
}));

vi.mock('../services/agent-config', () => ({
  ensureGitignore: vi.fn(),
}));

vi.mock('../services/log-service', () => ({
  appLog: vi.fn(),
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

import { BrowserWindow, dialog, ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { registerProjectHandlers } from './project-handlers';

describe('project-handlers', () => {
  let handlers: Map<string, (...args: any[]) => any>;

  beforeEach(() => {
    handlers = new Map();
    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: any) => {
      handlers.set(channel, handler);
    });
    registerProjectHandlers();
  });

  it('registers PICK_DIR handler', () => {
    expect(handlers.has(IPC.PROJECT.PICK_DIR)).toBe(true);
  });

  it('PICK_DIR opens dialog with createDirectory property', async () => {
    const handler = handlers.get(IPC.PROJECT.PICK_DIR)!;
    await handler({});

    expect(dialog.showOpenDialog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        properties: expect.arrayContaining(['openDirectory', 'createDirectory']),
      }),
    );
  });

  it('PICK_DIR returns null when no focused window', async () => {
    vi.mocked(BrowserWindow.getFocusedWindow).mockReturnValueOnce(null);
    const handler = handlers.get(IPC.PROJECT.PICK_DIR)!;
    const result = await handler({});
    expect(result).toBeNull();
  });

  it('PICK_DIR returns null when dialog is canceled', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: true,
      filePaths: [],
    });
    const handler = handlers.get(IPC.PROJECT.PICK_DIR)!;
    const result = await handler({});
    expect(result).toBeNull();
  });

  it('PICK_DIR returns selected path on success', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: ['/Users/me/new-project'],
    });
    const handler = handlers.get(IPC.PROJECT.PICK_DIR)!;
    const result = await handler({});
    expect(result).toBe('/Users/me/new-project');
  });
});
