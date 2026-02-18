import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AboutSettingsView } from './AboutSettingsView';

// Mock window.clubhouse
Object.defineProperty(globalThis, 'window', {
  value: {
    clubhouse: {
      app: {
        getVersion: vi.fn().mockResolvedValue('1.2.3'),
        getArchInfo: vi.fn().mockResolvedValue({ arch: 'arm64', platform: 'darwin', rosetta: false }),
      },
    },
  },
  writable: true,
});

// Mock the manifest-validator module
vi.mock('../../plugins/manifest-validator', () => ({
  SUPPORTED_API_VERSIONS: ['0.5'],
}));

describe('AboutSettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders version', async () => {
    render(<AboutSettingsView />);
    expect(await screen.findByText(/1\.2\.3/)).toBeTruthy();
  });

  it('renders architecture for arm64', async () => {
    render(<AboutSettingsView />);
    expect(await screen.findByText('arm64')).toBeTruthy();
  });

  it('renders Rosetta warning when running under translation', async () => {
    (window.clubhouse.app.getArchInfo as ReturnType<typeof vi.fn>).mockResolvedValue({
      arch: 'x64',
      platform: 'darwin',
      rosetta: true,
    });
    render(<AboutSettingsView />);
    expect(await screen.findByText('x64 (Rosetta)')).toBeTruthy();
    expect(await screen.findByText(/running under Rosetta translation/)).toBeTruthy();
  });

  it('does not show Rosetta warning for native x64', async () => {
    (window.clubhouse.app.getArchInfo as ReturnType<typeof vi.fn>).mockResolvedValue({
      arch: 'x64',
      platform: 'darwin',
      rosetta: false,
    });
    render(<AboutSettingsView />);
    expect(await screen.findByText('x64')).toBeTruthy();
    expect(screen.queryByText(/Rosetta/)).toBeNull();
  });

  it('renders plugin API versions', async () => {
    render(<AboutSettingsView />);
    expect(await screen.findByText('0.5')).toBeTruthy();
  });
});
