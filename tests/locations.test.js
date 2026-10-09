import assert from 'node:assert/strict';
import test from 'node:test';
import { loadLocations, parseBackup, STORAGE_KEY } from '../src/locations.js';

const location = {
  id: 'my-location', company: 'My account', status: 'Customer',
  city: 'Chicago', state: 'IL', address: 'Chicago, IL',
  lat: 41.88, lng: -87.63, locationType: 'Warehouse', source: 'Manual entry',
};
const storageWith = (value) => ({ getItem: (key) => key === STORAGE_KEY ? value : null });

test('a fresh browser gets customers, prospects, and multiple facilities per demo company', () => {
  const locations = loadLocations(storageWith(null));
  assert.ok(locations.some((item) => item.status === 'Customer'));
  assert.ok(locations.some((item) => item.status === 'Prospect'));
  assert.ok(new Set(locations.map((item) => item.company)).size < locations.length);
  assert.ok(locations.every((item) => item.source.startsWith('Fictional demo')));
  assert.ok(locations.every((item) => !item.sourceUrl && !item.verifiedUrl));
});

test('existing browser locations survive the rename without being replaced by demo data', () => {
  assert.deepEqual(loadLocations(storageWith(JSON.stringify([location]))), [location]);
});

test('an intentionally empty territory stays empty', () => {
  assert.deepEqual(loadLocations(storageWith('[]')), []);
});

test('corrupt or incompatible saved data safely falls back to the demo', () => {
  for (const saved of ['{bad', '{}', '[null]', '[{"company":"Broken"}]']) {
    assert.ok(loadLocations(storageWith(saved)).length > 0);
  }
});

test('JSON backups round-trip existing location metadata', () => {
  const original = [{ ...location, verificationStatus: 'Verified', sourceUrl: 'https://example.com' }];
  assert.deepEqual(parseBackup(JSON.parse(JSON.stringify(original))), original);
});

test('rejects backup records that would crash map rendering or put markers outside the world', () => {
  for (const value of [null, {}, [null], [{ ...location, company: '' }],
    [{ ...location, status: 'Unknown' }], [{ ...location, lat: 91 }],
    [{ ...location, lng: -181 }], [{ ...location, lat: '41.88' }],
    [{ ...location, city: {} }], [{ ...location, address: null }],
    [location, { ...location }]]) {
    assert.throws(() => parseBackup(value), /Invalid map backup/);
  }
});
