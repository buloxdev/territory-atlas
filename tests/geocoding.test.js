import assert from 'node:assert/strict';
import test from 'node:test';
import { geocodeAddress } from '../src/geocoding.js';

test('address lookup caches repeat queries and spaces new requests at least one second apart', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push({ at: Date.now(), url: String(url) });
    return new Response(JSON.stringify([{ lat: '41.88', lon: '-87.63', address: { city: 'Chicago' } }]), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const first = await geocodeAddress('Chicago, IL', 'https://example.com/search');
    const repeat = await geocodeAddress('Chicago, IL', 'https://example.com/search');
    const another = await geocodeAddress('Milwaukee, WI', 'https://example.com/search');
    assert.deepEqual(repeat, first);
    assert.equal(another[0].lat, '41.88');
    assert.equal(requests.length, 2);
    assert.ok(requests[1].at - requests[0].at >= 1000);
    assert.equal(new URL(requests[0].url).searchParams.get('q'), 'Chicago, IL');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
