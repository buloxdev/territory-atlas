import assert from 'node:assert/strict';
import test from 'node:test';
import { createProviderConnection, providerRequest, loadProviderConnection, saveProviderConnection, clearProviderConnection, providerFailure } from '../src/search-provider.js';
import { searchArea } from '../src/discovery.js';
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), values }; };
const area = {lat:42.2711,lng:-89.094,radius:5000};

test('managed access requires a key and sends it only to the fixed Geofabrik endpoint', () => {
  assert.throws(() => createProviderConnection(''), /API key/);
  assert.throws(() => createProviderConnection('a\nb'), /API key/);
  assert.throws(() => providerRequest({provider:'another-provider',apiKey:'test-key'}), /Connect/);
  const request = providerRequest(createProviderConnection('  test/key?value  ', 'geofabrik'));
  assert.equal(request.endpoint,'https://overpass.geofabrik.de/test%2Fkey%3Fvalue/api/interpreter');
  assert.equal(request.serviceName,'Geofabrik');
});

test('connection is kept in tab storage, survives reload, and disconnect removes it', () => {
  const session = storage(), connection = createProviderConnection('test-key', 'geofabrik');
  assert.equal(loadProviderConnection(session),null);
  saveProviderConnection(connection,session);assert.deepEqual(loadProviderConnection(session),connection);
  clearProviderConnection(session);assert.equal(loadProviderConnection(session),null);
  session.setItem('territory-atlas-search-provider-v1','{broken');assert.equal(loadProviderConnection(session),null);
  assert.equal(loadProviderConnection({getItem(){throw new Error('blocked');}}),null);
});

const response = (status, code = '', retry = null) => ({status, ok:false, headers:new Headers(retry ? {'Retry-After':retry}:{}),json:async()=>({error:{code,message:'raw provider text that must not appear'}})});
test('invalid credentials and billing do not cause an arbitrary one-minute cooldown', async () => {
  for(const status of [401,403,402]) {
    const error = await providerFailure(response(status),'Geofabrik');
    assert.equal(error.retryAfterMs,0);assert.doesNotMatch(error.message,/raw provider/);
    assert.match(error.message,status===402?/paid subscription/:/API key/);
  }
});
test('rate limits honor Retry-After while quota exhaustion calls for account action', async () => {
  const limited = await providerFailure(response(429,'rate_limited','12'),'Geofabrik');
  assert.equal(limited.retryAfterMs,12000);assert.match(limited.message,/12 seconds/);
  const quota = await providerFailure(response(429,'quota_exceeded','3600'),'Geofabrik');
  assert.equal(quota.retryAfterMs,0);assert.match(quota.message,/quota.*reached/);
  const date = await providerFailure(response(503,'no_backend','Thu, 08 Oct 2026 20:10:10 GMT'),'Geofabrik',Date.parse('2026-10-08T20:10:00Z'));
  assert.equal(date.retryAfterMs,10000);
});
test('managed search retains access errors and never converts failed authorization into empty results', async () => {
  const options = providerRequest(createProviderConnection('invalid-test-key', 'geofabrik'));
  await assert.rejects(searchArea(area,'manufacturers',{...options,fetchImpl:async()=>response(401,'invalid_key')}),error=>/Geofabrik rejected access/.test(error.message)&&error.retryAfterMs===0);
});
