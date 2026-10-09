export const STORAGE_KEY = 'freight-network-locations-v1';
// Fictional businesses at city centers, not real company or facility addresses.
export const DEMO_LOCATIONS = [
  { id: 'demo-prairie-chicago', company: 'Prairie Supply Co.', status: 'Customer', locationType: 'Distribution Center', city: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298 },
  { id: 'demo-prairie-milwaukee', company: 'Prairie Supply Co.', status: 'Customer', locationType: 'Warehouse', city: 'Milwaukee', state: 'WI', lat: 43.0389, lng: -87.9065 },
  { id: 'demo-great-lakes', company: 'Great Lakes Packaging', status: 'Prospect', locationType: 'Manufacturing Plant', city: 'Rockford', state: 'IL', lat: 42.2711, lng: -89.094 },
  { id: 'demo-northstar', company: 'Northstar Components', status: 'Prospect', locationType: 'Manufacturing Plant', city: 'Madison', state: 'WI', lat: 43.0731, lng: -89.4012 },
  { id: 'demo-riverbend', company: 'Riverbend Foods', status: 'Customer', locationType: 'Distribution Center', city: 'Indianapolis', state: 'IN', lat: 39.7684, lng: -86.1581 },
  { id: 'demo-heartland', company: 'Heartland Industrial', status: 'Prospect', locationType: 'Warehouse', city: 'Fort Wayne', state: 'IN', lat: 41.0793, lng: -85.1394 },
  { id: 'demo-ridgeway-columbus', company: 'Ridgeway Distribution', status: 'Prospect', locationType: 'Distribution Center', city: 'Columbus', state: 'OH', lat: 39.9612, lng: -82.9988 },
  { id: 'demo-ridgeway-cincinnati', company: 'Ridgeway Distribution', status: 'Prospect', locationType: 'Warehouse', city: 'Cincinnati', state: 'OH', lat: 39.1031, lng: -84.512 },
  { id: 'demo-crossroads', company: 'Crossroads Materials', status: 'Customer', locationType: 'Corporate HQ', city: 'St. Louis', state: 'MO', lat: 38.627, lng: -90.1994 },
  { id: 'demo-cedar', company: 'Cedar Valley Equipment', status: 'Prospect', locationType: 'Warehouse', city: 'Des Moines', state: 'IA', lat: 41.5868, lng: -93.625 },
].map((location) => ({
  ...location,
  address: `${location.city}, ${location.state} (demo city center)`,
  source: 'Fictional demo · city center',
  verificationStatus: 'Needs review',
}));

export function parseBackup(value) {
  if (!Array.isArray(value)) throw new Error('Invalid map backup.');
  const ids = new Set();
  for (const item of value) {
    if (!item || typeof item !== 'object'
      || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)
      || typeof item.company !== 'string' || !item.company.trim()
      || !['Customer', 'Prospect'].includes(item.status)
      || !Number.isFinite(item.lat) || Math.abs(item.lat) > 90
      || !Number.isFinite(item.lng) || Math.abs(item.lng) > 180
      || ['city', 'state', 'address', 'locationType', 'source'].some((field) => typeof item[field] !== 'string')) {
      throw new Error('Invalid map backup. Each location needs a unique ID, company, relationship, location details, and valid coordinates.');
    }
    ids.add(item.id);
  }
  return value;
}

export function loadLocations(storage = localStorage) {
  try {
    const saved = storage.getItem(STORAGE_KEY);
    return saved ? parseBackup(JSON.parse(saved)) : DEMO_LOCATIONS;
  } catch {
    return DEMO_LOCATIONS;
  }
}
