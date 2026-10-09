import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDiscoveryRequest, buildDiscoveryQuery, circleFeature, distanceMeters, prepareDiscoveredLocations, mergeDiscoveredLocations, searchArea } from '../src/discovery.js';
import { areaBounds } from '../src/search-area.js';
import { parseBackup } from '../src/locations.js';

const area = { lng: -89.094, lat: 42.2711, radius: 5000 };
const element = (id, tags = {}, coordinates = {}) => ({ type: 'node', id, lat: area.lat, lon: area.lng, tags: { name: 'Example Works', man_made: 'works', ...tags }, ...coordinates });

test('recognizes supported requests and rejects qualifiers it cannot honor', () => {
  assert.equal(parseDiscoveryRequest('Find manufactures in this area').id, 'manufacturers');
  assert.equal(parseDiscoveryRequest('find food manufacturers nearby').id, 'food');
  assert.equal(parseDiscoveryRequest('Show me warehouses in this circle').id, 'warehouses');
  assert.equal(parseDiscoveryRequest('distributors').id, 'distributors');
  assert.equal(parseDiscoveryRequest('aerospace manufacturers'), null);
  assert.equal(parseDiscoveryRequest('manufacturers with over 100 employees'), null);
  assert.equal(parseDiscoveryRequest('manufacturers and warehouses'), null);
});

test('circle geometry closes and remains at the requested ground distance', () => {
  const polygon = circleFeature(area).geometry.coordinates[0];
  assert.deepEqual(polygon[0], polygon.at(-1));
  for (const [lng, lat] of polygon) assert.ok(Math.abs(distanceMeters(area, { lng, lat }) - area.radius) < 0.01);
});

test('queries a bounded circle with fixed category filters, never interpolating arbitrary user text', () => {
  const query = buildDiscoveryQuery(area, 'manufacturers');
  const b = areaBounds(area);
  assert.ok(query.includes(`(${b.south},${b.west},${b.north},${b.east})`));
  assert.ok(!query.includes('around:'));
  assert.match(query, /man_made/);
  assert.match(query, /out center tags 200/);
  assert.throws(() => buildDiscoveryQuery({ ...area, radius: 50001 }, 'manufacturers'), /31.1 miles/);
  assert.throws(() => buildDiscoveryQuery({ ...area, lng: 'bad' }, 'manufacturers'), /circle/);
  assert.throws(() => buildDiscoveryQuery(area, 'arbitrary'), /category/);
});

test('keeps named facilities inside the circle, handles centers, safe links and marks existing accounts', () => {
  const existing = [{ id: 'old', company: 'Example Works', lat: area.lat, lng: area.lng }];
  const data = { elements: [element(1, { website: 'javascript:alert(1)' }), element(2), element(3, { name: '' }), element(4, {}, { lat: 0 }), element(5, {}, { lat: null }), { type: 'way', id: 6, center: { lat: area.lat + .02, lon: area.lng }, tags: { name: 'Other Plant', website: 'other.example', 'addr:city': 'Rockford', 'addr:state': 'US-IL' } }] };
  const rows = prepareDiscoveredLocations(data, area, 'manufacturers', existing);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].duplicate, true);
  assert.equal(rows[0].website, '');
  assert.equal(rows[1].website, 'https://other.example/');
  assert.equal(rows[1].state, 'IL');
  assert.equal(rows[1].verificationStatus, 'Needs review');
  assert.equal(rows[1].sourceUrl, 'https://www.openstreetmap.org/way/6');
  parseBackup(rows.map(({ duplicate, distance, ...location }) => location));
  assert.throws(() => prepareDiscoveredLocations({ remark: 'runtime error: timed out', elements: [] }, area, 'manufacturers', []), /incomplete/);
});

test('merge rechecks duplicates against the latest territory and preserves existing customer records', () => {
  const rows = prepareDiscoveredLocations({ elements: [element(1), element(2, { name: 'New Factory' }, { lat: area.lat + .01 })] }, area, 'manufacturers', []);
  const existing = [{ id: 'customer', company: 'Example Works', status: 'Customer', lat: area.lat, lng: area.lng }];
  const merged = mergeDiscoveredLocations(existing, rows);
  assert.equal(merged.added, 1);
  assert.equal(merged.locations[0], existing[0]);
  assert.equal(merged.locations[1].status, 'Prospect');
  assert.equal(mergeDiscoveredLocations(merged.locations, rows).added, 0);
});

test('search rejects busy services and partial responses instead of presenting them as no matches', async () => {
  const endpoint = 'https://search.example/interpreter';
  await assert.rejects(searchArea(area, 'warehouses', { endpoint, fetchImpl: async () => ({ ok: false, status: 429 }) }), /limiting requests/);
  await assert.rejects(searchArea(area, 'warehouses', { endpoint, fetchImpl: async () => ({ ok: true, json: async () => ({ remark: 'timeout', elements: [] }) }) }), /incomplete/);
});

test('malformed source elements and non-text address tags cannot crash a results list', () => {
  const rows = prepareDiscoveredLocations({ elements: [null, {}, element(8, { 'addr:state': { bad: true } })] }, area, 'manufacturers', []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].state, '');
});

test('identical successful searches are cached while a failed search is never cached', async () => {
  const endpoint = 'https://cache-test.example/interpreter';
  let calls = 0;
  const fetchImpl = async () => { calls++; return { ok: true, json: async () => ({ elements: [element(1)] }) }; };
  const first = await searchArea(area, 'manufacturers', { endpoint, fetchImpl });
  const second = await searchArea(area, 'manufacturers', { endpoint, fetchImpl });
  assert.equal(calls, 1);
  assert.deepEqual(second, first);
  const failing = async () => { calls++; return { ok: false, status: 503 }; };
  await assert.rejects(searchArea(area, 'food', { endpoint, fetchImpl: failing }), /unavailable/);
  await assert.rejects(searchArea(area, 'food', { endpoint, fetchImpl: failing }), /unavailable/);
  assert.equal(calls, 3);
});

test('network failures identify the search service while cancellation stays cancellable', async () => {
  await assert.rejects(searchArea(area, 'manufacturers', { endpoint: 'https://offline.example/api', fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }), /service could not be reached/);
  await assert.rejects(searchArea(area, 'manufacturers', { endpoint: 'https://cancel.example/api', fetchImpl: async () => { throw new DOMException('Cancelled', 'AbortError'); } }), { name: 'AbortError' });
});
