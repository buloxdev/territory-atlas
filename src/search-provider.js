const STORAGE_KEY = 'territory-atlas-search-provider-v1';
export const SEARCH_PROVIDERS = {
  tomtom: { id: 'tomtom', name: 'TomTom', accountUrl: 'https://my.tomtom.com/', pricingUrl: 'https://docs.tomtom.com/pricing', previewOnly: true },
  geofabrik: { id: 'geofabrik', name: 'Geofabrik', accountUrl: 'https://www.geofabrik.de/data/overpass-api.html', previewOnly: false },
};
export const SEARCH_PROVIDER = SEARCH_PROVIDERS.tomtom;

export function createProviderConnection(apiKey, provider = SEARCH_PROVIDER.id) {
  if (!Object.hasOwn(SEARCH_PROVIDERS, provider)) throw new Error('Choose a supported search provider.');
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!key || key.length > 512 || /\s/.test(key)) throw new Error(`Enter your ${SEARCH_PROVIDERS[provider].name} API key.`);
  return { provider, apiKey: key };
}
export function providerRequest(connection) {
  if (!connection || !Object.hasOwn(SEARCH_PROVIDERS, connection.provider)) throw new Error('Connect your search provider before searching.');
  const { apiKey, provider } = createProviderConnection(connection.apiKey, connection.provider);
  if (provider === 'tomtom') return { provider, apiKey, endpoint: 'https://api.tomtom.com/maps/orbis/places/discover', serviceName: 'TomTom' };
  return { provider, endpoint: `https://overpass.geofabrik.de/${encodeURIComponent(apiKey)}/api/interpreter`, serviceName: 'Geofabrik' };
}
export function loadProviderConnection(storage) {
  try {
    const value = JSON.parse((storage || globalThis.sessionStorage).getItem(STORAGE_KEY));
    return value && Object.hasOwn(SEARCH_PROVIDERS, value.provider) ? createProviderConnection(value.apiKey, value.provider) : null;
  } catch { return null; }
}
export function saveProviderConnection(connection, storage = sessionStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(createProviderConnection(connection.apiKey, connection.provider)));
}
export function clearProviderConnection(storage = sessionStorage) { storage.removeItem(STORAGE_KEY); }

export async function providerFailure(response, serviceName = 'The search service', now = Date.now()) {
  const error = new Error(); error.retryAfterMs = 0;
  let code = '';
  try { const data = await response.json(); code = typeof data?.error?.code === 'string' ? data.error.code : typeof data?.code === 'string' ? data.code : ''; } catch { /* HTML errors are not displayed; they can echo request credentials. */ }
  const retry = response.headers?.get('Retry-After');
  const milliseconds = retry && /^\d+(\.\d+)?$/.test(retry) ? Number(retry) * 1000 : retry ? Date.parse(retry) - now : 0;
  if (response.status === 401 || response.status === 403) error.message = `${serviceName} rejected access. Check your API key, enabled API products, account limits, and allowed browser domains.`;
  else if (response.status === 402) error.message = `${serviceName} requires an active paid subscription. Check your provider account.`;
  else if (response.status === 429 && /quota/i.test(code)) error.message = `${serviceName}'s account quota has been reached. Review your plan or wait for its quota reset; retrying immediately will not help.`;
  else if (response.status === 429 || response.status === 406) {
    error.retryAfterMs = Number.isFinite(milliseconds) && milliseconds > 0 ? milliseconds : 30000;
    error.message = `${serviceName} is limiting requests. Try again in ${Math.ceil(error.retryAfterMs / 1000)} seconds, or review your account limits.`;
  } else if (response.status === 400) error.message = `${serviceName} could not accept this search. Try redrawing a smaller, simpler area. If it persists, the search integration needs review.`;
  else if (response.status === 504) error.message = `${serviceName} could not finish this search in time. Search a smaller area or contact provider support.`;
  else error.message = `${serviceName} is unavailable (HTTP ${response.status}). Try again later or contact provider support.`;
  if (response.status === 503 && Number.isFinite(milliseconds) && milliseconds > 0) error.retryAfterMs = milliseconds;
  return error;
}
