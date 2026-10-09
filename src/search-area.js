export const METERS_PER_MILE = 1609.344;
export const MAX_SEARCH_RADIUS_MILES = 100;
export const MAX_SEARCH_RADIUS_METERS = MAX_SEARCH_RADIUS_MILES * METERS_PER_MILE;
const EARTH_RADIUS = 6371008.8;
const radians = value => value * Math.PI / 180;
const coordinateValid = point => point && Number.isFinite(point.lng) && Math.abs(point.lng) <= 180 && Number.isFinite(point.lat) && Math.abs(point.lat) <= 85;
export const isFreehand = area => area?.type === 'polygon';

export function distanceMeters(a, b) {
  const lat = radians(b.lat - a.lat), lng = radians(b.lng - a.lng);
  const h = Math.sin(lat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(lng / 2) ** 2;
  return EARTH_RADIUS * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function areaBounds(area) {
  const points = isFreehand(area) ? area.points : circleFeature(area).geometry.coordinates[0].map(([lng, lat]) => ({ lng, lat }));
  return { west: Math.min(...points.map(p => p.lng)), east: Math.max(...points.map(p => p.lng)), south: Math.min(...points.map(p => p.lat)), north: Math.max(...points.map(p => p.lat)) };
}
export function areaCenter(area) {
  if (!isFreehand(area)) return { lng: area.lng, lat: area.lat };
  const bounds = areaBounds(area);
  return { lng: (bounds.west + bounds.east) / 2, lat: (bounds.south + bounds.north) / 2 };
}
const cross = (a, b, c) => (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
const onSegment = (p, a, b) => Math.abs(cross(a, b, p)) < 1e-12 && p.lng >= Math.min(a.lng, b.lng) - 1e-10 && p.lng <= Math.max(a.lng, b.lng) + 1e-10 && p.lat >= Math.min(a.lat, b.lat) - 1e-10 && p.lat <= Math.max(a.lat, b.lat) + 1e-10;
function intersects(a, b, c, d) {
  const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
  return (abC * abD < 0 && cdA * cdB < 0) || onSegment(c, a, b) || onSegment(d, a, b) || onSegment(a, c, d) || onSegment(b, c, d);
}

export function validateSearchArea(area) {
  if (!isFreehand(area)) {
    if (!coordinateValid(area) || !Number.isFinite(area.radius) || area.radius < 100 || area.radius > MAX_SEARCH_RADIUS_METERS) throw new Error(`Draw a circle with a radius between about 0.06 and ${MAX_SEARCH_RADIUS_MILES} miles.`);
    return area;
  }
  const points = area.points;
  if (!Array.isArray(points) || points.length < 3 || points.length > 128 || points.some(p => !coordinateValid(p))) throw new Error('Draw a valid outline with at least three distinct points.');
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      if (intersects(points[i], points[(i + 1) % points.length], points[j], points[(j + 1) % points.length])) throw new Error('Draw a clear outline without crossing its own edges.');
    }
  }
  const center = areaCenter(area), extent = Math.max(...points.map(point => distanceMeters(center, point)));
  if (extent > MAX_SEARCH_RADIUS_METERS) throw new Error(`Keep the outline within ${MAX_SEARCH_RADIUS_MILES} miles of its center. Zoom in and draw a smaller area.`);
  const signed = points.reduce((sum, a, i) => { const b = points[(i + 1) % points.length]; return sum + (a.lng - center.lng) * (b.lat - center.lat) - (b.lng - center.lng) * (a.lat - center.lat); }, 0);
  if (extent < 100 || Math.abs(signed) < 1e-8) throw new Error('The outline is too small or flat. Draw around a larger area.');
  return area;
}

// Simplify the stroke before querying the service; preserve concave corners.
function simplify(points, tolerance) {
  if (points.length <= 2) return points;
  const factor = Math.cos(radians(points[0].lat)), project = p => ({ x: p.lng * factor * 111195, y: p.lat * 111195 });
  const a = project(points[0]), b = project(points.at(-1));
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  let farthest = tolerance * tolerance, index = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const p = project(points[i]);
    const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
    const d = (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2;
    if (d > farthest) { farthest = d; index = i; }
  }
  return index < 0 ? [points[0], points.at(-1)] : [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)];
}
export function createFreehandArea(stroke) {
  if (!Array.isArray(stroke) || stroke.some(point => !coordinateValid(point))) throw new Error('Draw a valid outline.');
  let points = stroke.filter((point, i) => !i || distanceMeters(point, stroke[i - 1]) > 1);
  if (points.length > 3 && distanceMeters(points[0], points.at(-1)) < 10) points = points.slice(0, -1);
  let tolerance = 20, simplified = simplify(points, tolerance);
  while (simplified.length > 128) { tolerance *= 2; simplified = simplify(points, tolerance); }
  const area = { type: 'polygon', points: simplified };
  validateSearchArea(area);
  const center = areaCenter(area);
  return { ...area, ...center, radius: Math.max(...simplified.map(point => distanceMeters(center, point))) };
}

export function circleFeature(area) {
  validateSearchArea(area);
  const lat = radians(area.lat), lng = radians(area.lng), angle = area.radius / EARTH_RADIUS;
  const points = Array.from({ length: 65 }, (_, index) => {
    const bearing = radians((index % 64) * 360 / 64);
    const y = Math.asin(Math.sin(lat) * Math.cos(angle) + Math.cos(lat) * Math.sin(angle) * Math.cos(bearing));
    const x = lng + Math.atan2(Math.sin(bearing) * Math.sin(angle) * Math.cos(lat), Math.cos(angle) - Math.sin(lat) * Math.sin(y));
    return [x * 180 / Math.PI, y * 180 / Math.PI];
  });
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [points] } };
}
export function areaFeature(area) {
  validateSearchArea(area);
  if (!isFreehand(area)) return circleFeature(area);
  const points = area.points.map(p => [p.lng, p.lat]);
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...points, points[0]]] } };
}
export function containsPoint(area, point) {
  if (!coordinateValid(point)) return false;
  if (!isFreehand(area)) return distanceMeters(area, point) <= area.radius + .001;
  let inside = false;
  for (let i = 0, j = area.points.length - 1; i < area.points.length; j = i++) {
    const a = area.points[j], b = area.points[i];
    if (onSegment(point, a, b)) return true;
    if ((a.lat > point.lat) !== (b.lat > point.lat) && point.lng < (b.lng - a.lng) * (point.lat - a.lat) / (b.lat - a.lat) + a.lng) inside = !inside;
  }
  return inside;
}
export function translateArea(area, target) {
  const center = areaCenter(area);
  const moved = isFreehand(area) ? { ...area, points: area.points.map(p => ({ lng: p.lng + target.lng - center.lng, lat: p.lat + target.lat - center.lat })), ...target } : { ...area, ...target };
  validateSearchArea(moved);
  return moved;
}
export function areaHandles(area) {
  if (!isFreehand(area)) {
    const points = circleFeature(area).geometry.coordinates[0];
    return ['n', 'e', 's', 'w'].map((id, i) => ({ id, lng: points[i * 16][0], lat: points[i * 16][1] }));
  }
  const b = areaBounds(area);
  return [{ id: 'nw', lng: b.west, lat: b.north }, { id: 'ne', lng: b.east, lat: b.north }, { id: 'se', lng: b.east, lat: b.south }, { id: 'sw', lng: b.west, lat: b.south }];
}
export function resizeArea(area, handle, target) {
  if (!isFreehand(area)) return { ...area, radius: Math.max(100, Math.min(MAX_SEARCH_RADIUS_METERS, distanceMeters(area, target))) };
  const b = areaBounds(area), east = handle.includes('e'), north = handle.includes('n');
  const anchor = { lng: east ? b.west : b.east, lat: north ? b.south : b.north };
  const width = b.east - b.west, height = b.north - b.south;
  const sx = Math.max(.05, (target.lng - anchor.lng) / (east ? width : -width));
  const sy = Math.max(.05, (target.lat - anchor.lat) / (north ? height : -height));
  const points = area.points.map(p => ({ lng: anchor.lng + (p.lng - anchor.lng) * sx, lat: anchor.lat + (p.lat - anchor.lat) * sy }));
  const next = { type: 'polygon', points }; validateSearchArea(next);
  const center = areaCenter(next);
  return { ...next, ...center, radius: Math.max(...points.map(point => distanceMeters(center, point))) };
}
