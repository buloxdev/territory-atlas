// Repaints a vector basemap as a blueprint: drafting-blue ground, white line-work, quiet labels.
// Colors mirror the :root tokens in blueprint.css; MapLibre paint properties cannot read CSS variables.
export const BLUEPRINT = {
  bg: '#0b2a5b', bg2: '#0d3270', water: '#0a2550', fg: '#ffffff', muted: '#cfe3ff', accent: '#ffc857',
  line: 'rgba(255,255,255,0.32)', lineSoft: 'rgba(255,255,255,0.16)', building: 'rgba(255,255,255,0.05)',
};

const has = (id, ...words) => words.some(word => id.includes(word));

export function blueprintPaint(layer) {
  const id = layer.id.toLowerCase(), source = String(layer['source-layer'] || '').toLowerCase();
  const water = has(id, 'water', 'ocean', 'lake', 'river') || has(source, 'water');
  switch (layer.type) {
    case 'background': return { 'background-color': BLUEPRINT.bg };
    case 'fill':
      if (water) return { 'fill-color': BLUEPRINT.water, 'fill-opacity': 1, 'fill-outline-color': BLUEPRINT.line };
      if (has(id, 'building') || source === 'building') return { 'fill-color': BLUEPRINT.building, 'fill-outline-color': BLUEPRINT.lineSoft, 'fill-opacity': 1 };
      return { 'fill-color': BLUEPRINT.bg, 'fill-opacity': 0 };
    case 'line':
      if (has(id, 'casing')) return { 'line-opacity': 0 };
      if (has(id, 'boundary', 'admin')) return { 'line-color': 'rgba(255,255,255,0.55)', 'line-opacity': 1 };
      if (water) return { 'line-color': BLUEPRINT.line, 'line-opacity': 1 };
      if (has(id, 'motorway', 'trunk', 'primary')) return { 'line-color': 'rgba(255,255,255,0.42)', 'line-opacity': 1 };
      if (has(id, 'rail')) return { 'line-color': BLUEPRINT.lineSoft, 'line-opacity': 1 };
      return { 'line-color': 'rgba(255,255,255,0.2)', 'line-opacity': 1 };
    case 'symbol':
      return { 'text-color': has(id, 'water') ? 'rgba(207,227,255,0.6)' : BLUEPRINT.muted, 'text-halo-color': BLUEPRINT.bg, 'text-halo-width': 1.2, 'icon-opacity': 0.35 };
    case 'fill-extrusion': return { 'fill-extrusion-color': '#2d5a9e' };
    case 'hillshade': return { 'hillshade-shadow-color': BLUEPRINT.bg, 'hillshade-highlight-color': BLUEPRINT.bg2, 'hillshade-accent-color': BLUEPRINT.bg };
    default: return {};
  }
}

// Points of interest add noise to a drafting sheet; place, road, and water labels stay.
const hidden = layer => layer.type === 'symbol' && /^poi|_poi|poi_/.test(layer.id.toLowerCase());

export function applyBlueprintStyle(map) {
  for (const layer of map.getStyle().layers) {
    if (hidden(layer)) { map.setLayoutProperty(layer.id, 'visibility', 'none'); continue; }
    for (const [property, value] of Object.entries(blueprintPaint(layer))) {
      // Some styles omit properties for a layer type; a failed repaint should never block the map.
      try { map.setPaintProperty(layer.id, property, value); } catch { /* keep the original paint */ }
    }
  }
}
