import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { StartupMarker } from '../../shared/plugin-types';

function getMarkerPath(): string {
  return path.join(app.getPath('home'), '.clubhouse', '.startup-marker');
}

export function readMarker(): StartupMarker | null {
  try {
    const raw = fs.readFileSync(getMarkerPath(), 'utf-8');
    return JSON.parse(raw) as StartupMarker;
  } catch {
    return null;
  }
}

export function writeMarker(enabledPlugins: string[]): void {
  const existing = readMarker();
  const marker: StartupMarker = {
    timestamp: Date.now(),
    attempt: existing ? existing.attempt + 1 : 1,
    lastEnabledPlugins: enabledPlugins,
  };
  const dir = path.dirname(getMarkerPath());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getMarkerPath(), JSON.stringify(marker), 'utf-8');
}

export function clearMarker(): void {
  try {
    fs.unlinkSync(getMarkerPath());
  } catch {
    // Already gone
  }
}

export function shouldShowSafeModeDialog(): boolean {
  const marker = readMarker();
  return marker !== null && marker.attempt >= 2;
}

export function incrementAttempt(enabledPlugins: string[]): void {
  writeMarker(enabledPlugins);
}
