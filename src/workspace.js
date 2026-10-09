import { DEMO_LOCATIONS, parseBackup, STORAGE_KEY } from './locations.js';

export const DEMO_STORAGE_KEY = 'territory-atlas-demo-v1';
export const MODE_KEY = 'territory-atlas-workspace-v1';
export const workspaceKey = mode => mode === 'demo' ? DEMO_STORAGE_KEY : STORAGE_KEY;

export function readWorkspace(storage) {
  const mode = storage.getItem(MODE_KEY) === 'demo' ? 'demo' : 'territory';
  const saved = storage.getItem(workspaceKey(mode));
  if (saved !== null) return { mode, locations: parseBackup(JSON.parse(saved)) };
  if (mode === 'demo') return { mode, locations: DEMO_LOCATIONS };
  return { mode: null, locations: [] };
}

export function readTerritory(storage) {
  const saved = storage.getItem(STORAGE_KEY);
  return saved === null ? [] : parseBackup(JSON.parse(saved));
}

export function writeWorkspace(storage, mode, locations) {
  // Write data before the selected mode, so a failed save cannot select absent data.
  storage.setItem(workspaceKey(mode), JSON.stringify(parseBackup(locations)));
  storage.setItem(MODE_KEY, mode);
}
