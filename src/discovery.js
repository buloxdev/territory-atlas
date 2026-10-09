import { areaBounds, areaCenter, containsPoint, validateSearchArea } from './search-area.js';
import { providerFailure } from './search-provider.js';
import { distanceMeters } from './search-area.js';
import { searchTomTomArea } from './tomtom-search.js';
export { circleFeature, distanceMeters } from './search-area.js';
export const DISCOVERY_CATEGORIES = [
  { id: 'manufacturers', label: 'Manufacturers', aliases: /^(manufacturers?|manufactures?|manufacturing|factories|factory|plants?)$/, filters: ['["man_made"="works"]', '["industrial"="factory"]'], locationType: 'Manufacturing Plant' },
  { id: 'warehouses', label: 'Warehouses', aliases: /^(warehouses?|warehousing|storage facilities)$/, filters: ['["industrial"="warehouse"]', '["building"="warehouse"]'], locationType: 'Warehouse' },
  { id: 'distributors', label: 'Distributors', aliases: /^(distributors?|distribution centers?|distribution centres?|wholesalers?)$/, filters: ['["industrial"="distributor"]', '["shop"="wholesale"]'], locationType: 'Distribution Center' },
  { id: 'food', label: 'Food manufacturers', aliases: /^(food (manufacturers?|manufactures?|factories|processors?|processing))$/, filters: ['["man_made"="works"]["product"~"food|beverage|meat|dairy|bakery|bread|snack|cereal",i]', '["industrial"~"food|bakery|slaughterhouse",i]'], locationType: 'Manufacturing Plant' },
  { id: 'metal', label: 'Metal manufacturers', aliases: /^(metal (manufacturers?|fabricators?|factories))$/, filters: ['["man_made"="works"]["product"~"metal|steel|alumin|iron",i]', '["industrial"~"metal|steel|alumin",i]'], locationType: 'Manufacturing Plant' },
  { id: 'packaging', label: 'Packaging manufacturers', aliases: /^(packaging( manufacturers?|factories|companies)?|paper (manufacturers?|mills?))$/, filters: ['["man_made"="works"]["product"~"packaging|paper|cardboard|carton",i]', '["industrial"~"paper|packaging",i]'], locationType: 'Manufacturing Plant' },
];

export function parseDiscoveryRequest(text, provider = 'geofabrik') {
  if (typeof text !== 'string') return null;
  const words = text.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/g, '').replace(/^(please\s+)?(find|show|search(?: for)?|look for|look up)(\s+me)?(?:\s+|$)/i, '').replace(/^(some|other|nearby|more)\s+/i, '').replace(/(?:^|\s+)(in|within|around)\s+(this|the|my|selected)\s+(area|circle|region)$/i, '').replace(/\s+nearby$/i, '').trim();
  if (!words || words.length > 200) return null;
  const known = DISCOVERY_CATEGORIES.find(category => category.aliases.test(words.toLowerCase()));
  if (known) return known;
  if (provider !== 'tomtom') return null;
  const manufacturing = words.match(/^(.+)\s+(manufacturers?|manufactures?|manufacturing|factories|factory|plants?)$/i);
  return { id: 'custom', label: words, query: manufacturing ? manufacturing[1].trim() : words, keyword: true, ...(manufacturing ? { scope: 'manufacturers' } : {}) };
}

export function buildDiscoveryQuery(area, categoryId) {
  validateSearchArea(area);
  const category = DISCOVERY_CATEGORIES.find(item => item.id === categoryId);
  if (!category) throw new Error('Choose a supported business category.');
  // Retrieve nearby candidates using the spatial index, then apply the exact
  // circle/freehand test to feature centers in prepareDiscoveredLocations.
  // Overpass around/poly queries can be much slower for ways and relations.
  const bounds = areaBounds(area);
  const box = `(${bounds.south},${bounds.west},${bounds.north},${bounds.east})`;
  return `[out:json][timeout:25][maxsize:16777216];(${category.filters.map(filter => `nwr${filter}["name"]${box};`).join('')});out center tags 200;`;
}

const normalize = text => (text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function isDiscoveredDuplicate(location, existing) {
  return existing.some(item => item.id === location.id || (location.sourceUrl && item.sourceUrl === location.sourceUrl) || (normalize(item.company) === normalize(location.company) && Number.isFinite(item.lat) && Number.isFinite(item.lng) && distanceMeters(item, location) < 150));
}

function safeWebsite(value) {
  if (!value || typeof value !== 'string') return '';
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

export function prepareDiscoveredLocations(data, area, categoryId, existing) {
  if (data?.provider === 'tomtom') return prepareTomTomLocations(data, area, categoryId, existing);
  if (data?.remark || !Array.isArray(data?.elements)) throw new Error('The search service returned an incomplete response. Try a smaller area or try again later.');
  const category = DISCOVERY_CATEGORIES.find(item => item.id === categoryId);
  if (!category) throw new Error('Choose a supported business category.');
  const rows = [];
  for (const item of data.elements) {
    if (!item || typeof item !== 'object') continue;
    const tags = Object.fromEntries(Object.entries(item.tags || {}).filter(([, value]) => typeof value === 'string')), lat = item.lat ?? item.center?.lat, lng = item.lon ?? item.center?.lon;
    if (!['node', 'way', 'relation'].includes(item.type) || !Number.isSafeInteger(item.id) || item.id < 1 || typeof tags.name !== 'string' || !tags.name.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) continue;
    const distance = distanceMeters(areaCenter(area), { lat, lng });
    if (!containsPoint(area, { lat, lng })) continue;
    const city = tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || '';
    const state = (tags['addr:state'] || '').replace(/^US-/, '');
    const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
    const location = {
      id: `osm-${item.type}-${item.id}`, company: tags.name.trim(), status: 'Prospect', locationType: category.locationType,
      lat, lng, city, state, address: [street, city, state, tags['addr:postcode']].filter(Boolean).join(', '),
      source: 'OpenStreetMap discovery', sourceLicense: 'ODbL-1.0', sourceAttribution: '© OpenStreetMap contributors', sourceUrl: `https://www.openstreetmap.org/${item.type}/${item.id}`,
      website: safeWebsite(tags.website || tags['contact:website']), verificationStatus: 'Needs review',
      discoveryCategory: category.label, discoveredAt: new Date().toISOString(),
      coordinateNote: item.type === 'node' ? 'Mapped point; verify facility and entrance.' : 'Mapped feature center; verify facility and entrance.',
      distance, duplicate: false,
    };
    if (isDiscoveredDuplicate(location, rows)) continue;
    location.duplicate = isDiscoveredDuplicate(location, existing);
    rows.push(location);
  }
  return rows.sort((a, b) => a.distance - b.distance);
}

function prepareTomTomLocations(data, area, categoryId, existing) {
  if (!Array.isArray(data.results)) throw new Error('TomTom returned an incomplete response. Please try again.');
  const custom = categoryId?.id === 'custom' && typeof categoryId.query === 'string' && categoryId.query.trim().length > 0 && categoryId.query.trim().length <= 200;
  const category = DISCOVERY_CATEGORIES.find(item => item.id === categoryId) || (custom ? { label: typeof categoryId.label === 'string' && categoryId.label.trim() ? categoryId.label.trim() : categoryId.query.trim() } : null);
  if (!category) throw new Error('Choose a supported business category.');
  const rows = [], text = value => typeof value === 'string' ? value.trim() : '';
  for (const item of data.results) {
    if (!item || item.type !== 'poi' || typeof item.id !== 'string' || !item.id || !text(item.title) || item.position?.type !== 'Point') continue;
    const [lng, lat] = Array.isArray(item.position.coordinates) ? item.position.coordinates : [];
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !containsPoint(area, {lat, lng})) continue;
    const address = item.address || {}, city = text(address.municipality), state = text(address.countrySubdivisionCodeIso).replace(/^US-/, '') || text(address.countrySubdivision);
    const street = [text(address.houseNumber), text(address.street)].filter(Boolean).join(' ');
    const contacts = Array.isArray(item.contacts) ? item.contacts : [];
    const websites = contacts.flatMap(contact => Array.isArray(contact?.websites) ? contact.websites : []);
    const types = Array.isArray(item.poiTypes) ? item.poiTypes : [];
    const location = {
      id: `tomtom-${item.id}`, company: text(item.title), status: 'Prospect', lat, lng, city, state,
      address: [street, city, state, text(address.postalCode)].filter(Boolean).join(', '),
      locationType: text(types[0]?.name) || category.label,
      website: websites.map(safeWebsite).find(Boolean) || '',
      source: 'TomTom discovery', sourceAttribution: '© TomTom', sourceLicense: 'TomTom terms',
      verificationStatus: 'Needs review', previewOnly: true, discoveryCategory: category.label,
      coordinateNote: 'Provider point; verify the facility and entrance.',
      distance: distanceMeters(areaCenter(area), {lat, lng}), duplicate: false,
    };
    if (isDiscoveredDuplicate(location, rows)) continue;
    location.duplicate = isDiscoveredDuplicate(location, existing);
    rows.push(location);
  }
  return rows.sort((a, b) => a.distance - b.distance);
}

export function mergeDiscoveredLocations(existing, selected) {
  if (selected.some(row => row.previewOnly || row.source === 'TomTom discovery')) throw new Error('TomTom results are for review only while saving and export permissions are confirmed.');
  const locations = [...existing];
  for (const row of selected) {
    if (isDiscoveredDuplicate(row, locations)) continue;
    const { distance, duplicate, ...location } = row;
    locations.push(location);
  }
  return { locations, added: locations.length - existing.length };
}

// A few repeat searches are cached in memory; no background polling or endpoint rotation.
const cache = new Map();
export function clearDiscoveryCache() { cache.clear(); }
export async function searchArea(area, categoryId, { provider, apiKey, endpoint, serviceName, signal, fetchImpl = fetch } = {}) {
  if (provider === 'tomtom') return searchTomTomArea(area, categoryId, {apiKey, signal, fetchImpl});
  const query = buildDiscoveryQuery(area, categoryId), key = `${endpoint}|${query}`, cached = cache.get(key);
  if (cached && Date.now() - cached.time < 300000) return cached.data;
  const timeout = AbortSignal.timeout(35000);
  let response;
  try {
    response = await fetchImpl(endpoint, { method: 'POST', body: new URLSearchParams({ data: query }), signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  } catch (error) {
    if (signal?.aborted || ['AbortError', 'TimeoutError'].includes(error.name)) throw error;
    throw new Error('The business search service could not be reached. It may be unavailable or blocking browser requests. Try again later.', { cause: error });
  }
  if (!response.ok) throw await providerFailure(response, serviceName);
  const data = await response.json();
  if (data?.remark || !Array.isArray(data?.elements)) throw new Error('The search service returned an incomplete response. Try a smaller area or try again later.');
  if (cache.size >= 20) cache.delete(cache.keys().next().value);
  cache.set(key, { time: Date.now(), data });
  return data;
}
