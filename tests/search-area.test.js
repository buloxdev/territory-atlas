import assert from 'node:assert/strict';
import test from 'node:test';
import { createFreehandArea, areaFeature, containsPoint, translateArea, resizeArea, areaHandles, areaBounds, areaCenter, validateSearchArea } from '../src/search-area.js';
import { buildDiscoveryQuery, prepareDiscoveredLocations } from '../src/discovery.js';

const circle = { lng: -89, lat: 42, radius: 2000 };
const outline = [ { lng: -89.04, lat: 42 }, { lng: -88.96, lat: 42 }, { lng: -88.96, lat: 42.04 }, { lng: -89, lat: 42.04 }, { lng: -89, lat: 42.02 }, { lng: -89.04, lat: 42.02 } ];

test('freehand preserves an irregular outline, closes it, and excludes points in its notch', () => {
  const shape = createFreehandArea(outline);
  assert.equal(shape.type, 'polygon');
  const ring = areaFeature(shape).geometry.coordinates[0];
  assert.deepEqual(ring[0], ring.at(-1));
  assert.equal(containsPoint(shape, { lng: -89.02, lat: 42.01 }), true);
  assert.equal(containsPoint(shape, { lng: -89.02, lat: 42.03 }), false);
  assert.equal(containsPoint(shape, { lng: -89.04, lat: 42.01 }), true);
  assert.equal(containsPoint(shape, { lng: -90, lat: 42.01 }), false);
});

test('rejects crossings, collapsed outlines, excessive extents, and invalid coordinates', () => {
  assert.throws(() => createFreehandArea([{ lng: -89, lat: 42 }, { lng: -88.98, lat: 42.02 }, { lng: -89, lat: 42.02 }, { lng: -88.98, lat: 42 }]), /cross/);
  assert.throws(() => createFreehandArea([{ lng: -89, lat: 42 }, { lng: -89, lat: 42 }, { lng: -89, lat: 42 }]), /outline/);
  assert.throws(() => createFreehandArea([{ lng: -89, lat: 42 }, { lng: -87, lat: 42 }, { lng: -89, lat: 44 }]), /31.1 miles/);
  assert.throws(() => validateSearchArea({ type: 'polygon', points: [...outline, { lat: NaN, lng: -89 }] }), /outline/);
});

test('moving a circle preserves its radius and translates all polygon vertices', () => {
  const moved = translateArea(circle, { lng: -88.9, lat: 42.05 });
  assert.equal(moved.radius, circle.radius);
  assert.equal(moved.lng, -88.9);
  const polygon = createFreehandArea(outline), center = areaCenter(polygon);
  const shifted = translateArea(polygon, { lng: center.lng + .01, lat: center.lat + .01 });
  assert.ok(Math.abs(shifted.points[0].lng - outline[0].lng - .01) < 1e-8);
  assert.ok(Math.abs(shifted.points[0].lat - outline[0].lat - .01) < 1e-8);
  assert.equal(containsPoint(shifted, { lng: -89.01, lat: 42.02 }), true);
});

test('edge handles resize circles; polygon corner handles scale the outline from the opposite corner', () => {
  const handles = areaHandles(circle);
  assert.equal(handles.length, 4);
  const bigger = resizeArea(circle, handles[1].id, { lng: -88.94, lat: 42 });
  assert.ok(bigger.radius > circle.radius);
  assert.equal(bigger.lng, circle.lng);
  const polygon = createFreehandArea(outline);
  const expanded = resizeArea(polygon, 'ne', { lng: -88.94, lat: 42.06 });
  assert.equal(expanded.points[0].lng, polygon.points[0].lng);
  assert.equal(expanded.points[0].lat, polygon.points[0].lat);
  assert.ok(expanded.points[2].lat > polygon.points[2].lat);
  assert.equal(expanded.points.length, polygon.points.length);
});

test('polygon requests use indexed bounding boxes and discard candidates outside an irregular shape', () => {
  const polygon = createFreehandArea(outline);
  const query = buildDiscoveryQuery(polygon, 'manufacturers');
  const b = areaBounds(polygon);
  assert.ok(query.includes(`(${b.south},${b.west},${b.north},${b.east})`));
  assert.ok(!query.includes('around:'));
  const elements = [ { type: 'node', id: 1, lat: 42.01, lon: -89.02, tags: { name: 'Inside', man_made: 'works' } }, { type: 'node', id: 2, lat: 42.03, lon: -89.02, tags: { name: 'In the notch', man_made: 'works' } } ];
  assert.deepEqual(prepareDiscoveredLocations({ elements }, polygon, 'manufacturers', []).map(row => row.company), ['Inside']);
});
