import type { PluginManifest } from '../../../../shared/plugin-types';

const BTOP_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><polyline points="6 13 9 9 12 11 15 7 18 10"/></svg>`;

export const manifest: PluginManifest = {
  id: 'btop',
  name: 'Resource Monitor',
  version: '1.0.0',
  description: 'System resource monitor powered by btop.',
  author: 'Clubhouse',
  engine: { api: 0.5 },
  scope: 'app',
  permissions: ['terminal', 'commands', 'process'],
  allowedCommands: ['which'],
  contributes: {
    railItem: { label: 'Resource Monitor', icon: BTOP_ICON, position: 'top' },
    commands: [{ id: 'restart', title: 'Restart Resource Monitor' }],
    help: {
      topics: [
        {
          id: 'resource-monitor',
          title: 'Resource Monitor',
          content: [
            '## Resource Monitor',
            '',
            'The Resource Monitor provides a live system resource dashboard powered by btop.',
            '',
            '### Requirements',
            'The `btop` command-line tool must be installed on your system. Install it via your package manager (e.g. `brew install btop` on macOS).',
            '',
            '### Usage',
            'Click the Resource Monitor icon in the sidebar rail to open the monitor. It launches btop in an embedded terminal session.',
            '',
            '### Restarting',
            'Use the **Restart** button in the toolbar or the **Restart btop** command to kill the current session and start fresh.',
          ].join('\n'),
        },
      ],
    },
  },
};
