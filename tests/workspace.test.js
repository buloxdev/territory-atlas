import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_LOCATIONS, STORAGE_KEY } from '../src/locations.js';
import { readWorkspace, readTerritory, writeWorkspace, DEMO_STORAGE_KEY } from '../src/workspace.js';
const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

test('fresh visitors choose a workspace before any demo is saved', () => {
  const store = storage();
  assert.deepEqual(readWorkspace(store), { mode: null, locations: [] });
  assert.equal(store.getItem(STORAGE_KEY), null);
});

test('demo edits stay separate from real accounts through refresh and workspace switches', () => {
  const store = storage();
  const real = [{ ...DEMO_LOCATIONS[0], id: 'real-one', company: 'My real account', source: 'My spreadsheet' }];
  writeWorkspace(store, 'territory', real);
  writeWorkspace(store, 'demo', DEMO_LOCATIONS.slice(1));
  assert.equal(readWorkspace(store).mode, 'demo');
  assert.deepEqual(readTerritory(store), real);
  writeWorkspace(store, 'territory', readTerritory(store));
  assert.deepEqual(readWorkspace(store).locations, real);
  assert.equal(JSON.parse(store.getItem(DEMO_STORAGE_KEY)).length, 9);
});

test('existing and intentionally empty territories resume without welcome or added demo records', () => {
  const store = storage();
  store.setItem(STORAGE_KEY, JSON.stringify(DEMO_LOCATIONS.slice(0, 1)));
  assert.equal(readWorkspace(store).locations.length, 1);
  store.setItem(STORAGE_KEY, '[]');
  assert.deepEqual(readWorkspace(store), { mode: 'territory', locations: [] });
});

test('corrupt data and storage failures are surfaced instead of overwritten with demo data', () => {
  const store = storage();
  store.setItem(STORAGE_KEY, '{bad');
  assert.throws(() => readWorkspace(store));
  assert.equal(store.getItem(STORAGE_KEY), '{bad');
  assert.throws(() => writeWorkspace({ setItem() { throw Error('Storage full'); } }, 'territory', []), /Storage full/);
});
