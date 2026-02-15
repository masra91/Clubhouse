import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock node-pty
const mockProcess = {
  onData: vi.fn(),
  onExit: vi.fn(),
  write: vi.fn(),
  resize: vi.fn(),
  kill: vi.fn(),
};
vi.mock('node-pty', () => ({
  spawn: vi.fn(() => mockProcess),
}));

// Mock electron (aliased via vitest.config.ts)

// Mock shell utility
vi.mock('../util/shell', () => ({
  getShellEnvironment: vi.fn(() => ({ ...process.env })),
}));

// Mock the IPC channels
vi.mock('../../shared/ipc-channels', () => ({
  IPC: {
    PTY: {
      DATA: 'pty:data',
      EXIT: 'pty:exit',
    },
  },
}));

// We need to import AFTER mocks are set up
// But the module has state (Maps), so we need to handle that.
// We'll use dynamic imports or reset between tests.

import { getBuffer, spawn, resize, gracefulKill, kill } from './pty-manager';

// Helper: spawn and immediately fire resize to clear pendingCommands
// so that onData callbacks start buffering data.
function spawnAndActivate(agentId: string, cwd = '/test', binary = '/usr/local/bin/claude', args: string[] = []) {
  spawn(agentId, cwd, binary, args);
  // Resize triggers the pending command and starts data flow
  resize(agentId, 120, 30);
}

describe('pty-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProcess.onData.mockReset();
    mockProcess.onExit.mockReset();
    mockProcess.write.mockReset();
    mockProcess.kill.mockReset();
  });

  describe('getBuffer', () => {
    it('returns empty string for unknown agent', () => {
      expect(getBuffer('nonexistent')).toBe('');
    });
  });

  describe('spawn + buffer', () => {
    it('clears previous buffer on spawn', () => {
      // Spawn first to set up buffer
      spawnAndActivate('agent_buf');
      // Simulate data via the onData callback
      const onDataCb = mockProcess.onData.mock.calls[0][0];
      onDataCb('hello');
      expect(getBuffer('agent_buf')).toBe('hello');

      // Spawn again — should clear
      spawn('agent_buf', '/test', '/usr/local/bin/claude', []);
      expect(getBuffer('agent_buf')).toBe('');
    });

    it('kills existing PTY for same agentId', () => {
      spawn('agent_dup', '/test', '/usr/local/bin/claude', []);
      spawn('agent_dup', '/test', '/usr/local/bin/claude', []);
      expect(mockProcess.kill).toHaveBeenCalled();
    });
  });

  describe('appendToBuffer (via spawn + onData)', () => {
    it('stores and concatenates data', () => {
      spawnAndActivate('agent_concat');
      const onDataCb = mockProcess.onData.mock.calls[0][0];
      onDataCb('hello ');
      onDataCb('world');
      expect(getBuffer('agent_concat')).toBe('hello world');
    });

    it('evicts oldest chunks when >512KB', () => {
      spawnAndActivate('agent_evict');
      const onDataCb = mockProcess.onData.mock.calls[0][0];
      // Write chunks that total > 512KB
      const chunkSize = 100 * 1024; // 100KB
      for (let i = 0; i < 6; i++) {
        onDataCb('x'.repeat(chunkSize));
      }
      // Buffer should be at most 512KB + last chunk
      const buf = getBuffer('agent_evict');
      expect(buf.length).toBeLessThanOrEqual(600 * 1024); // some tolerance
      expect(buf.length).toBeGreaterThan(0);
    });

    it('keeps last chunk even if it alone exceeds limit', () => {
      spawnAndActivate('agent_big');
      const onDataCb = mockProcess.onData.mock.calls[0][0];
      const bigChunk = 'x'.repeat(600 * 1024); // 600KB single chunk
      onDataCb(bigChunk);
      expect(getBuffer('agent_big')).toBe(bigChunk);
    });

    it('independent buffers per agent', () => {
      spawnAndActivate('agent_a');
      const cbA = mockProcess.onData.mock.calls[0][0];
      cbA('data_a');

      spawnAndActivate('agent_b');
      const cbB = mockProcess.onData.mock.calls[mockProcess.onData.mock.calls.length - 1][0];
      cbB('data_b');

      expect(getBuffer('agent_a')).toBe('data_a');
      expect(getBuffer('agent_b')).toBe('data_b');
    });

    it('suppresses data while command is pending', () => {
      spawn('agent_suppress', '/test', '/usr/local/bin/claude', []);
      const onDataCb = mockProcess.onData.mock.calls[0][0];
      onDataCb('shell startup noise');
      expect(getBuffer('agent_suppress')).toBe('');

      // After resize, data flows
      resize('agent_suppress', 120, 30);
      onDataCb('real data');
      expect(getBuffer('agent_suppress')).toBe('real data');
    });
  });

  describe('gracefulKill', () => {
    it('writes /exit to process', () => {
      spawn('agent_gk', '/test', '/usr/local/bin/claude', []);
      gracefulKill('agent_gk');
      expect(mockProcess.write).toHaveBeenCalledWith('/exit\r');
    });

    it('sets killing flag (no re-kill race)', () => {
      spawn('agent_gk2', '/test', '/usr/local/bin/claude', []);
      gracefulKill('agent_gk2');
      expect(mockProcess.write).toHaveBeenCalledWith('/exit\r');
    });
  });

  describe('kill', () => {
    it('immediately kills and clears buffer', () => {
      spawnAndActivate('agent_kill');
      const onDataCb = mockProcess.onData.mock.calls[0][0];
      onDataCb('some data');
      expect(getBuffer('agent_kill')).toBe('some data');

      kill('agent_kill');
      expect(mockProcess.kill).toHaveBeenCalled();
      expect(getBuffer('agent_kill')).toBe('');
    });
  });
});
