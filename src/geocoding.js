const cache = new Map();
let lastRequestAt = 0;
let pending = Promise.resolve();

export function geocodeAddress(address, endpoint) {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({ format: 'jsonv2', limit: '1', addressdetails: '1', q: address });
  const key = url.toString();
  const result = pending.then(async () => {
    if (cache.has(key)) return cache.get(key);
    const delay = Math.max(0, 1000 - (Date.now() - lastRequestAt));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    lastRequestAt = Date.now();
    const response = await fetch(url);
    if (!response.ok) throw new Error('Location search failed.');
    const results = await response.json();
    if (!Array.isArray(results)) throw new Error('Location search returned an invalid response.');
    cache.set(key, results);
    return results;
  });
  pending = result.catch(() => {});
  return result;
}
