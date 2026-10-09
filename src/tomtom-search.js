import { areaCenter, isFreehand, validateSearchArea } from './search-area.js';
import { providerFailure } from './search-provider.js';

export const TOMTOM_CATEGORIES = {
  manufacturers: { poiTypes: ['manufacturing_facility', 'industrial_facility'], query: '' },
  distributors: { poiTypes: ['import_or_export_and_distribution'], query: '' },
  // TomTom has no general warehouse type or dedicated food/metal/packaging
  // manufacturing subtypes. These are explicitly presented as keyword searches.
  warehouses: { query: 'warehouse', keyword: true },
  food: { poiTypes: ['manufacturing_facility', 'industrial_facility'], query: 'food', keyword: true },
  metal: { poiTypes: ['manufacturing_facility', 'industrial_facility'], query: 'metal', keyword: true },
  packaging: { poiTypes: ['manufacturing_facility', 'industrial_facility'], query: 'packaging', keyword: true },
};

export function buildTomTomRequest(area, categoryId) {
  validateSearchArea(area);
  let category;
  if (categoryId?.id === 'custom') {
    const query = typeof categoryId.query === 'string' ? categoryId.query.trim() : '';
    if (!query || query.length > 200) throw new Error('Enter a business name or type using up to 200 characters.');
    category = { query, ...(categoryId.scope === 'manufacturers' ? { poiTypes: TOMTOM_CATEGORIES.manufacturers.poiTypes } : {}) };
  } else {
    category = Object.hasOwn(TOMTOM_CATEGORIES, categoryId) ? TOMTOM_CATEGORIES[categoryId] : null;
    if (!category) throw new Error('Choose a supported business category.');
  }
  const center = areaCenter(area);
  let geometry;
  if (isFreehand(area)) {
    const coordinates = area.points.map(point => [point.lng, point.lat]);
    geometry = { type: 'simplePolygon', coordinates: [...coordinates, [...coordinates[0]]] };
  } else geometry = { type: 'circle', center: [area.lng, area.lat], radiusInMeters: Math.round(area.radius) };
  return {
    query: category.query,
    origin: { type: 'point', coordinates: [center.lng, center.lat] },
    maxResults: 100,
    filters: { types: ['poi'], ...(category.poiTypes ? { poiTypes: category.poiTypes } : {}), geometry },
  };
}

export async function searchTomTomArea(area, categoryId, { apiKey, signal, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error('Enter your TomTom API key before searching.');
  const body = JSON.stringify(buildTomTomRequest(area, categoryId));
  const timeout = AbortSignal.timeout(30000);
  let response;
  try {
    response = await fetchImpl('https://api.tomtom.com/maps/orbis/places/discover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'TomTom-Api-Key': apiKey, 'TomTom-Api-Version': '3',
        'Attributes': 'results(id,title,type,position,address,poiTypes,contacts)',
      },
      body,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted || ['AbortError', 'TimeoutError'].includes(error.name)) throw error;
    throw new Error('TomTom could not be reached. Check your connection and the browser domains allowed for your API key.', { cause: error });
  }
  if (!response.ok) throw await providerFailure(response, 'TomTom');
  let data;
  try { data = await response.json(); } catch { throw new Error('TomTom returned an incomplete response. Please try again.'); }
  // Discover can omit the selected results field when no places match (HTTP
  // 200 with {}). Accept that exact empty shape, not arbitrary partial data.
  if (data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0) data = { results: [] };
  if (data?.error || !Array.isArray(data?.results)) throw new Error('TomTom returned an incomplete response. Please try again.');
  // Trial results are transient: no persistent storage, export or repeat-query
  // cache until the applicable retention license has been confirmed.
  return { provider: 'tomtom', results: data.results, resultLimit: 100 };
}
