import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Electron's Notification and BrowserWindow
const mockShow = vi.fn();
const mockClose = vi.fn();
const mockOn = vi.fn();
let notificationInstances: Array<{ show: typeof mockShow; close: typeof mockClose; on: typeof mockOn }> = [];

vi.mock('electron', () => {
  return {
    Notification: class MockNotification {
      show = mockShow;
      close = mockClose;
      on = mockOn;
      static isSupported = vi.fn().mockReturnValue(true);
      constructor(_opts: Record<string, unknown>) {
        notificationInstances.push(this);
      }
    },
    BrowserWindow: {
      getAllWindows: vi.fn().mockReturnValue([]),
    },
  };
});

vi.mock('./settings-store', () => ({
  createSettingsStore: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue({}),
    save: vi.fn(),
  }),
}));

import { sendNotification, closeNotification } from './notification-service';

describe('notification-service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    notificationInstances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('sendNotification', () => {
    it('creates and shows a notification', () => {
      sendNotification('Title', 'Body', false);

      expect(notificationInstances).toHaveLength(1);
      expect(mockShow).toHaveBeenCalledOnce();
    });

    it('auto-dismisses notification after 5 seconds', () => {
      sendNotification('Title', 'Body', false, 'agent-1', 'proj-1');

      expect(mockClose).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5000);

      expect(mockClose).toHaveBeenCalledOnce();
    });

    it('auto-dismisses notifications without agent context after 5 seconds', () => {
      sendNotification('Title', 'Body', false);

      expect(mockClose).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5000);

      expect(mockClose).toHaveBeenCalledOnce();
    });

    it('replaces previous notification for same agent', () => {
      sendNotification('First', 'Body', false, 'agent-1', 'proj-1');

      expect(notificationInstances).toHaveLength(1);
      expect(mockClose).toHaveBeenCalledOnce(); // close is called for existing + then show

      // Reset to track second notification
      mockClose.mockClear();

      sendNotification('Second', 'Body', false, 'agent-1', 'proj-1');

      // Previous notification should be closed
      expect(mockClose).toHaveBeenCalledOnce();
      expect(notificationInstances).toHaveLength(2);
    });

    it('registers click and close event handlers', () => {
      sendNotification('Title', 'Body', false, 'agent-1', 'proj-1');

      expect(mockOn).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('close', expect.any(Function));
    });
  });

  describe('closeNotification', () => {
    it('programmatically closes an active notification', () => {
      sendNotification('Title', 'Body', false, 'agent-1', 'proj-1');
      mockClose.mockClear();

      closeNotification('agent-1', 'proj-1');

      expect(mockClose).toHaveBeenCalledOnce();
    });

    it('does nothing when no active notification for agent', () => {
      closeNotification('agent-1', 'proj-1');

      expect(mockClose).not.toHaveBeenCalled();
    });

    it('cancels the auto-dismiss timer when closed manually', () => {
      sendNotification('Title', 'Body', false, 'agent-1', 'proj-1');
      mockClose.mockClear();

      closeNotification('agent-1', 'proj-1');

      expect(mockClose).toHaveBeenCalledOnce();
      mockClose.mockClear();

      // Advance past the auto-dismiss time - should NOT close again
      vi.advanceTimersByTime(5000);

      expect(mockClose).not.toHaveBeenCalled();
    });

    it('does not affect notifications for other agents', () => {
      sendNotification('Title 1', 'Body', false, 'agent-1', 'proj-1');
      sendNotification('Title 2', 'Body', false, 'agent-2', 'proj-1');
      mockClose.mockClear();

      closeNotification('agent-1', 'proj-1');

      // Only one close call (for agent-1)
      expect(mockClose).toHaveBeenCalledOnce();

      mockClose.mockClear();

      // agent-2 should still auto-dismiss
      vi.advanceTimersByTime(5000);
      expect(mockClose).toHaveBeenCalledOnce();
    });
  });
});
