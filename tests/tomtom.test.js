import assert from 'node:assert/strict';
import test from 'node:test';
import { createProviderConnection, providerRequest, loadProviderConnection, saveProviderConnection } from '../src/search-provider.js';
import { buildTomTomRequest } from '../src/tomtom-search.js';
import { MAX_SEARCH_RADIUS_METERS } from '../src/search-area.js';
import { parseDiscoveryRequest, searchArea, prepareDiscoveredLocations, mergeDiscoveredLocations } from '../src/discovery.js';

const area = { lat: 42.2711, lng: -89.094, radius: 8046.72 };
const polygon = { type: 'polygon', points: [{lat:42.25,lng:-89.12},{lat:42.29,lng:-89.12},{lat:42.29,lng:-89.07},{lat:42.25,lng:-89.07}] };
const place = (id, title = 'Example Factory', coordinates = [area.lng, area.lat]) => ({ id, title, type: 'poi', position: {type:'Point',coordinates}, poiTypes:[{id:'manufacturing_facility',name:'Manufacturing facility'}], address:{street:'Industrial Drive',houseNumber:'12',municipality:'Rockford',countrySubdivisionCodeIso:'US-IL',postalCode:'61101'}, contacts:[{websites:['example.com']}] });

test('TomTom connection uses a fixed host and survives session storage with its provider identity', () => {
  const connection = createProviderConnection(' fixture-key ', 'tomtom'), request = providerRequest(connection);
  assert.equal(request.endpoint, 'https://api.tomtom.com/maps/orbis/places/discover');
  assert.equal(request.provider, 'tomtom');
  assert.equal(request.apiKey, 'fixture-key');
  assert.ok(!request.endpoint.includes('fixture-key'));
  const values = new Map(), storage = {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  saveProviderConnection(connection, storage); assert.deepEqual(loadProviderConnection(storage), connection);
  assert.throws(()=>createProviderConnection('key','https://evil.example'), /provider/);
});

test('TomTom constrains circle and freehand searches to the drawn boundary with explicit categories', () => {
  const request = buildTomTomRequest(area, 'manufacturers');
  assert.deepEqual(request.filters.geometry,{type:'circle',center:[area.lng,area.lat],radiusInMeters:8047});
  assert.deepEqual(request.filters.poiTypes,['manufacturing_facility','industrial_facility']);
  assert.deepEqual(request.filters.types,['poi']); assert.equal(request.maxResults,100);
  const outline = buildTomTomRequest(polygon,'distributors');
  assert.equal(outline.filters.geometry.type,'simplePolygon');
  assert.deepEqual(outline.filters.geometry.coordinates[0],outline.filters.geometry.coordinates.at(-1));
  assert.deepEqual(outline.filters.poiTypes,['import_or_export_and_distribution']);
  assert.equal(buildTomTomRequest(area,'warehouses').query,'warehouse');
  assert.equal(buildTomTomRequest(area,'food').query,'food');
  assert.equal(buildTomTomRequest({...area,radius:MAX_SEARCH_RADIUS_METERS},'manufacturers').filters.geometry.radiusInMeters,160934);
  assert.throws(()=>buildTomTomRequest({...area,radius:MAX_SEARCH_RADIUS_METERS+1},'manufacturers'),/100 miles/);
  assert.throws(()=>buildTomTomRequest(area,'injected'),/category/);
});

test('TomTom sends authenticated JSON without territory records, validates responses, and does not cache trial results', async () => {
  const options = providerRequest(createProviderConnection('fixture-key','tomtom')); let calls = 0;
  const fetchImpl = async (url, init) => {
    calls++; assert.equal(url,options.endpoint); assert.equal(init.method,'POST');
    assert.equal(init.headers['TomTom-Api-Key'],'fixture-key');
    assert.equal(init.headers['TomTom-Api-Version'],'3');
    assert.equal(init.headers['Content-Type'],'application/json');
    assert.equal(JSON.parse(init.body).filters.geometry.type,'circle');
    assert.ok(!init.body.includes('fixture-key')); assert.ok(init.signal);
    return {ok:true,json:async()=>({results:[place('1'),place('2','Another Factory')]})};
  };
  const data = await searchArea(area,'manufacturers',{...options,fetchImpl});
  assert.equal(data.provider,'tomtom'); assert.equal(data.results.length,2);
  await searchArea(area,'manufacturers',{...options,fetchImpl}); assert.equal(calls,2);
  await assert.rejects(searchArea(area,'manufacturers',{...options,fetchImpl:async()=>({ok:true,json:async()=>({error:{message:'bad'}})})}),/incomplete/);
  await assert.rejects(searchArea(area,'manufacturers',{...options,fetchImpl:async()=>({ok:false,status:401,json:async()=>({message:'fixture-key'})})}),/TomTom rejected access/);
  await assert.rejects(searchArea(area,'manufacturers',{...options,fetchImpl:async()=>{throw new DOMException('cancel','AbortError');}}),{name:'AbortError'});
});

test('TomTom results keep exact geometry, safe links, duplicates, and preview-only data out of territory backups', () => {
  const rows = prepareDiscoveredLocations({provider:'tomtom',results:[null,{},place('1'),place('2','Another Factory'),place('3','Outside',[0,0]),place('4','Bad',[null,42]),{...place('5','Unsafe site'),contacts:[{websites:['javascript:alert(1)']}]}]},area,'manufacturers',[{id:'saved',company:'Example Factory',lat:area.lat,lng:area.lng}]);
  assert.equal(rows.length,3); assert.equal(rows[0].duplicate,true);
  assert.equal(rows[1].website,'https://example.com/'); assert.equal(rows[1].state,'IL');
  assert.equal(rows[2].website,''); assert.equal(rows[1].previewOnly,true);
  assert.equal(rows[1].sourceAttribution,'© TomTom'); assert.notEqual(rows[1].sourceLicense,'ODbL-1.0');
  assert.throws(()=>mergeDiscoveredLocations([],rows),/TomTom.*review/);
  assert.equal(prepareDiscoveredLocations({provider:'tomtom',results:[place('1')]},polygon,'manufacturers',[]).length,1);
  assert.throws(()=>prepareDiscoveredLocations({provider:'tomtom'},area,'manufacturers',[]),/incomplete/);
});

test('custom TomTom business searches reach the provider and produce mapped preview results', async () => {
  const search = parseDiscoveryRequest('Find plastic manufacturers in this area', 'tomtom');
  assert.ok(search, 'A custom business type must be searchable');
  const options = providerRequest(createProviderConnection('fixture-key', 'tomtom'));
  const data = await searchArea(area, search, { ...options, fetchImpl: async (url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.query, 'plastic');
    assert.deepEqual(body.filters.geometry, { type: 'circle', center: [-89.094, 42.2711], radiusInMeters: 8047 });
    assert.deepEqual(body.filters.types, ['poi']);
    assert.deepEqual(body.filters.poiTypes, ['manufacturing_facility', 'industrial_facility'], 'A manufacturer request must exclude unrelated business types');
    return { ok: true, json: async () => ({ results: [place('plastic', 'Example Plastics'), place('outside', 'Outside', [0, 0])] }) };
  } });
  const rows = prepareDiscoveredLocations(data, area, search, []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].company, 'Example Plastics');
  assert.equal(rows[0].discoveryCategory, 'plastic manufacturers');
  assert.equal(rows[0].previewOnly, true);
});

test('custom text also searches freehand areas while unsupported Overpass requests remain blocked', () => {
  const search = parseDiscoveryRequest('Show me CNC machine shops in this area', 'tomtom');
  assert.ok(search, 'A custom business type must be searchable');
  const body = buildTomTomRequest(polygon, search);
  assert.equal(body.query, 'CNC machine shops');
  assert.equal(body.filters.poiTypes, undefined, 'An unrelated shortcut must not restrict a general text search');
  assert.deepEqual(body.filters.geometry.coordinates, [[-89.12, 42.25], [-89.12, 42.29], [-89.07, 42.29], [-89.07, 42.25], [-89.12, 42.25]]);
  assert.equal(parseDiscoveryRequest('CNC machine shops', 'geofabrik'), null);
  assert.equal(parseDiscoveryRequest('Find in this area', 'tomtom'), null);
  assert.equal(parseDiscoveryRequest('   ', 'tomtom'), null);
  assert.equal(parseDiscoveryRequest('x'.repeat(201), 'tomtom'), null);
  assert.throws(() => buildTomTomRequest(area, { id: 'custom', query: '' }), /business|search/i);
  assert.throws(() => buildTomTomRequest(area, { id: 'custom', query: 'x'.repeat(201) }), /business|search/i);
});

test('TomTom empty successful objects mean no matches while malformed responses still fail', async () => {
  const search = parseDiscoveryRequest('plastic manufacturers', 'tomtom');
  const options = { ...providerRequest(createProviderConnection('fixture-key', 'tomtom')), fetchImpl: async () => ({ ok: true, json: async () => ({}) }) };
  const data = await searchArea(area, search, options);
  assert.deepEqual(data.results, []);
  assert.deepEqual(prepareDiscoveredLocations(data, area, search, []), []);
  for (const malformed of [null, [], { unexpected: true }, { results: null }, { error: { code: 'failed' } }]) {
    await assert.rejects(searchArea(area, search, { ...options, fetchImpl: async () => ({ ok: true, json: async () => malformed }) }), /incomplete/);
  }
});
