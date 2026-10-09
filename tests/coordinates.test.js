import test from 'node:test';
import assert from 'node:assert/strict';
import { hasMapCoordinates } from '../src/coordinates.js';

test('missing or blank coordinates do not plot as a location at zero', () => {
  for (const missing of ['', '   ', null, undefined]) {
    assert.equal(hasMapCoordinates({ lat: missing, lng: -87 }), false);
    assert.equal(hasMapCoordinates({ lat: 41, lng: missing }), false);
  }
});

test('actual zero and numeric strings remain valid map coordinates', () => {
  assert.equal(hasMapCoordinates({ lat: 0, lng: 0 }), true);
  assert.equal(hasMapCoordinates({ lat: '41.8', lng: '-87.6' }), true);
});

test('non-numeric values and unsupported map latitudes stay unplaced', () => {
  for (const lat of ['unknown', Infinity, NaN, 86, -86]) {
    assert.equal(hasMapCoordinates({ lat, lng: -87 }), false);
  }
});
