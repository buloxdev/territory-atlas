// Schematic line-work for the Blueprint territory drawing. Outlines are simplified
// state borders (lng, lat) for the Midwest; they are illustrative, not survey grade.
export const OUTLINES = {
  WI: [[-90.64, 42.51], [-87.8, 42.49], [-87.9, 43], [-87.7, 43.7], [-87.5, 44.3], [-87, 45.25], [-87.6, 45.1], [-87.85, 45.45], [-88.4, 45.95], [-89.2, 46.1], [-90.1, 46.35], [-90.4, 46.6], [-91, 46.85], [-92.1, 46.7], [-92.3, 46.1], [-92.8, 45.6], [-92.8, 44.8], [-91.9, 44.3], [-91.25, 43.5], [-91.15, 42.9]],
  IL: [[-90.64, 42.51], [-87.8, 42.49], [-87.52, 41.76], [-87.53, 39.35], [-87.6, 38.9], [-87.95, 38.3], [-88.03, 37.8], [-88.1, 37.48], [-88.5, 37.1], [-89.13, 36.98], [-89.5, 37.3], [-89.9, 37.9], [-90.2, 38.6], [-90.6, 38.9], [-91.1, 39.4], [-91.45, 39.9], [-91.4, 40.4], [-91.1, 40.7], [-90.95, 41.3], [-90.3, 41.75], [-90.15, 42.1]],
  IN: [[-87.52, 41.76], [-84.81, 41.76], [-84.82, 39.1], [-84.9, 38.8], [-85.4, 38.7], [-85.9, 38], [-86.5, 37.95], [-87, 37.9], [-87.6, 37.95], [-88.03, 37.8], [-87.95, 38.3], [-87.6, 38.9], [-87.53, 39.35]],
  OH: [[-84.82, 41.7], [-83.45, 41.73], [-82.7, 41.45], [-81.7, 41.5], [-80.52, 41.98], [-80.52, 40.64], [-80.65, 40.4], [-80.85, 39.7], [-81.7, 39.2], [-82.2, 38.6], [-82.6, 38.4], [-83.1, 38.65], [-83.7, 38.63], [-84.3, 38.98], [-84.82, 39.1]],
  IA: [[-96.6, 43.5], [-91.22, 43.5], [-91.15, 42.9], [-90.64, 42.51], [-90.15, 42.1], [-90.3, 41.75], [-90.95, 41.3], [-91.1, 40.7], [-91.4, 40.4], [-91.73, 40.6], [-95.77, 40.58], [-96, 41], [-96.1, 41.6], [-96.5, 42.4]],
  MO: [[-95.77, 40.58], [-91.73, 40.6], [-91.4, 40.4], [-91.45, 39.9], [-91.1, 39.4], [-90.6, 38.9], [-90.2, 38.6], [-89.9, 37.9], [-89.5, 37.3], [-89.13, 36.98], [-89.7, 36], [-94.6, 36.5], [-94.6, 39.1], [-95, 39.9]],
  MI: [[-86.82, 41.76], [-86.5, 42.2], [-86.2, 42.8], [-86.45, 43.5], [-86.25, 44.2], [-85.6, 45.05], [-85, 45.75], [-84.7, 45.8], [-83.4, 44.9], [-83.3, 44], [-82.5, 43.6], [-82.4, 43], [-82.5, 42.6], [-83.2, 42.1], [-83.45, 41.73], [-84.81, 41.76]],
};

export const STATE_LABELS = { WI: [-89.9, 44.9], IL: [-89.2, 40.2], IN: [-86.2, 40.3], OH: [-82.6, 40.4], IA: [-93.5, 42.4], MO: [-92.6, 38.4], MI: [-84.6, 43.4] };
const STATE_NAMES = { WI: 'WISCONSIN', IL: 'ILLINOIS', IN: 'INDIANA', OH: 'OHIO', IA: 'IOWA', MO: 'MISSOURI', MI: 'MICHIGAN' };

const MILES_PER_DEGREE = 69;
const MAX_BALLOONS = 12;
const round = value => Math.round(value * 10) / 10;
const coordinate = value => value === '' || value == null ? NaN : Number(value);
const isPlaced = location => Number.isFinite(coordinate(location.lat)) && Number.isFinite(coordinate(location.lng)) && Math.abs(coordinate(location.lat)) <= 85;

// Lays out a numbered drawing: points in the middle, callout balloons in two gutters.
export function layoutTerritoryDrawing(locations, { width = 564, height = 500, gutter = 120, pad = 36, highlightMiles = 50 } = {}) {
  const points = locations.map((location, index) => ({ location, number: index + 1 })).filter(({ location }) => isPlaced(location));
  const lngs = points.map(({ location }) => Number(location.lng)), lats = points.map(({ location }) => Number(location.lat));
  const bounds = points.length
    ? { west: Math.min(...lngs) - 1.2, east: Math.max(...lngs) + 1.2, south: Math.min(...lats) - 1, north: Math.max(...lats) + 1 }
    : { west: -93.5, east: -83, south: 37.5, north: 45.5 };
  const midLat = (bounds.north + bounds.south) / 2, k = Math.cos(midLat * Math.PI / 180);
  const innerWidth = width - 2 * gutter, innerHeight = height - 2 * pad;
  const scale = Math.min(innerWidth / ((bounds.east - bounds.west) * k), innerHeight / (bounds.north - bounds.south));
  const offsetX = gutter + (innerWidth - (bounds.east - bounds.west) * k * scale) / 2;
  const offsetY = pad + (innerHeight - (bounds.north - bounds.south) * scale) / 2;
  const project = (lng, lat) => [round(offsetX + (lng - bounds.west) * k * scale), round(offsetY + (bounds.north - lat) * scale)];
  const pathFor = coordinates => `M${coordinates.map(([lng, lat]) => project(lng, lat).join(',')).join(' L')} Z`;

  const placed = points.map(point => {
    const [x, y] = project(Number(point.location.lng), Number(point.location.lat));
    return { ...point, x, y, customer: point.location.status === 'Customer' };
  });
  const callouts = placed.slice(0, MAX_BALLOONS);
  const byX = [...callouts].sort((a, b) => a.x - b.x);
  const leftCount = Math.ceil(byX.length / 2);
  const sides = [byX.slice(0, leftCount), byX.slice(leftCount)].map(side => side.sort((a, b) => a.y - b.y));
  const balloons = sides.flatMap((side, sideIndex) => side.map((point, index) => {
    const top = pad + 20, bottom = height - pad - 30;
    const by = side.length === 1 ? point.y : round(top + index * (bottom - top) / (side.length - 1));
    return { ...point, side: sideIndex ? 'right' : 'left', bx: sideIndex ? width - gutter + 22 : gutter - 22, by };
  }));
  const highlight = placed.find(point => point.customer) || placed[0] || null;
  return {
    width, height,
    states: Object.entries(OUTLINES).map(([code, outline]) => ({ code, d: pathFor(outline) })),
    labels: Object.entries(STATE_LABELS).map(([code, [lng, lat]]) => { const [x, y] = project(lng, lat); return { code, name: STATE_NAMES[code], x, y }; }),
    points: placed,
    balloons,
    highlight: highlight && { ...highlight, radius: round(highlightMiles / MILES_PER_DEGREE * scale), miles: highlightMiles },
    scaleBar: { miles: 100, length: round(100 / MILES_PER_DEGREE * scale) },
    counts: { customers: placed.filter(point => point.customer).length, prospects: placed.filter(point => !point.customer).length, unplaced: locations.length - placed.length },
  };
}
