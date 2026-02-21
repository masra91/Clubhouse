import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { PluginContext, PluginAPI, PluginModule } from '../../../../shared/plugin-types';

const SESSION_ID = 'btop:app';

export function activate(ctx: PluginContext, api: PluginAPI): void {
  const disposable = api.commands.register('restart', () => {
    // Handled via shared ref in MainPanel
  });
  ctx.subscriptions.push(disposable);
}

export function deactivate(): void {
  // Nothing to clean up — terminal session lives in the main process
}

type Status = 'checking' | 'not-installed' | 'installing' | 'starting' | 'running' | 'exited';

async function checkBtopInstalled(api: PluginAPI): Promise<boolean> {
  try {
    const result = await api.process.exec('which', ['btop']);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

function InstallView({ api, onInstalled }: { api: PluginAPI; onInstalled: () => void }) {
  const [installing, setInstalling] = useState(false);
  const ShellTerminal = api.terminal.ShellTerminal;
  const installSessionId = 'btop:install';

  const handleBrewInstall = useCallback(async () => {
    setInstalling(true);
    try {
      await api.terminal.spawn(installSessionId, '/');
      api.terminal.write(installSessionId, 'brew install btop\n');
    } catch {
      setInstalling(false);
    }
  }, [api]);

  useEffect(() => {
    if (!installing) return;
    const sub = api.terminal.onExit(installSessionId, async () => {
      const installed = await checkBtopInstalled(api);
      if (installed) {
        onInstalled();
      } else {
        setInstalling(false);
      }
    });
    return () => sub.dispose();
  }, [api, installing, onInstalled]);

  if (installing) {
    return React.createElement('div', { className: 'flex flex-col h-full bg-ctp-base' },
      React.createElement('div', {
        className: 'flex items-center gap-2 px-3 py-1.5 border-b border-ctp-surface0 bg-ctp-mantle flex-shrink-0',
      },
        React.createElement('span', { className: 'text-xs font-medium text-ctp-text' }, 'Installing btop...'),
      ),
      React.createElement('div', { className: 'flex-1 min-h-0' },
        React.createElement(ShellTerminal, { sessionId: installSessionId, focused: true }),
      ),
    );
  }

  return React.createElement('div', {
    className: 'flex items-center justify-center h-full bg-ctp-base',
  },
    React.createElement('div', { className: 'text-center max-w-md px-6' },
      React.createElement('div', { className: 'mb-4' },
        React.createElement('svg', {
          width: 48, height: 48, viewBox: '0 0 24 24', fill: 'none',
          stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
          className: 'mx-auto text-ctp-subtext0',
        },
          React.createElement('rect', { x: 2, y: 3, width: 20, height: 14, rx: 2 }),
          React.createElement('line', { x1: 8, y1: 21, x2: 16, y2: 21 }),
          React.createElement('line', { x1: 12, y1: 17, x2: 12, y2: 21 }),
          React.createElement('polyline', { points: '6 13 9 9 12 11 15 7 18 10' }),
        ),
      ),
      React.createElement('h2', { className: 'text-lg font-semibold text-ctp-text mb-2' }, 'Resource Monitor'),
      React.createElement('p', { className: 'text-sm text-ctp-subtext0 mb-4' },
        'btop is not installed on your system. Install it to use the Resource Monitor.',
      ),
      React.createElement('button', {
        className: 'px-4 py-2 rounded-lg bg-ctp-accent text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer mb-3',
        onClick: handleBrewInstall,
      }, 'Install with Homebrew'),
      React.createElement('p', { className: 'text-xs text-ctp-overlay0' },
        'Or install manually: ',
        React.createElement('code', { className: 'bg-surface-0 px-1.5 py-0.5 rounded text-ctp-subtext1' }, 'brew install btop'),
      ),
    ),
  );
}

export function MainPanel({ api }: { api: PluginAPI }) {
  const [status, setStatus] = useState<Status>('checking');
  const [exitCode, setExitCode] = useState<number | null>(null);
  const spawnedRef = useRef(false);

  const spawnBtop = useCallback(async () => {
    setStatus('starting');
    setExitCode(null);
    spawnedRef.current = false;
    try {
      await api.terminal.spawn(SESSION_ID, '/');
      setStatus('running');
      spawnedRef.current = true;
      api.terminal.write(SESSION_ID, 'btop\n');
    } catch {
      setStatus('exited');
    }
  }, [api]);

  // Check if btop is installed on mount
  useEffect(() => {
    if (spawnedRef.current) {
      setStatus('running');
      return;
    }
    api.terminal.getBuffer(SESSION_ID).then((buf) => {
      if (buf && buf.length > 0) {
        setStatus('running');
        spawnedRef.current = true;
      } else {
        checkBtopInstalled(api).then((installed) => {
          if (installed) {
            spawnBtop();
          } else {
            setStatus('not-installed');
          }
        });
      }
    });
  }, [api, spawnBtop]);

  useEffect(() => {
    const sub = api.terminal.onExit(SESSION_ID, (code) => {
      setStatus('exited');
      setExitCode(code);
      spawnedRef.current = false;
    });
    return () => sub.dispose();
  }, [api]);

  const handleRestart = useCallback(async () => {
    await api.terminal.kill(SESSION_ID);
    spawnBtop();
  }, [api, spawnBtop]);

  const handleInstalled = useCallback(() => {
    spawnBtop();
  }, [spawnBtop]);

  if (status === 'checking') {
    return React.createElement('div', {
      className: 'flex items-center justify-center h-full bg-ctp-base text-ctp-subtext0 text-xs',
    }, 'Checking for btop...');
  }

  if (status === 'not-installed') {
    return React.createElement(InstallView, { api, onInstalled: handleInstalled });
  }

  const ShellTerminal = api.terminal.ShellTerminal;

  const statusLabel =
    status === 'starting' ? 'Starting...' :
    status === 'running' ? 'Running' :
    `Exited${exitCode !== null ? ` (${exitCode})` : ''}`;

  const statusColor =
    status === 'running' ? 'text-ctp-green' :
    status === 'exited' ? 'text-ctp-red' :
    'text-ctp-subtext0';

  return React.createElement('div', { className: 'flex flex-col h-full bg-ctp-base' },
    React.createElement('div', {
      className: 'flex items-center justify-between px-3 py-1.5 border-b border-ctp-surface0 bg-ctp-mantle flex-shrink-0',
    },
      React.createElement('div', { className: 'flex items-center gap-2' },
        React.createElement('span', { className: 'text-xs font-medium text-ctp-text' }, 'Resource Monitor'),
        React.createElement('span', { className: `text-xs ${statusColor}` }, statusLabel),
      ),
      React.createElement('button', {
        className: 'flex items-center gap-1 px-2 py-0.5 text-xs text-ctp-subtext0 hover:text-ctp-text hover:bg-ctp-surface0 rounded transition-colors cursor-pointer',
        onClick: handleRestart,
        title: 'Restart Resource Monitor',
      },
        React.createElement('svg', {
          width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none',
          stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        },
          React.createElement('polyline', { points: '23 4 23 10 17 10' }),
          React.createElement('path', { d: 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10' }),
        ),
        'Restart',
      ),
    ),
    React.createElement('div', { className: 'flex-1 min-h-0' },
      status !== 'starting'
        ? React.createElement(ShellTerminal, { sessionId: SESSION_ID, focused: true })
        : React.createElement('div', {
            className: 'flex items-center justify-center h-full text-ctp-subtext0 text-xs',
          }, 'Starting Resource Monitor...'),
    ),
  );
}

const _: PluginModule = { activate, deactivate, MainPanel };
void _;
