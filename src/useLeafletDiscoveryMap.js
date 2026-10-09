import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { areaFeature } from './search-area.js';

export default function useLeafletDiscoveryMap(map, { area, results, onPick }) {
  const current = useRef(); current.current = { onPick };
  const areaLayer = useRef(null), resultLayer = useRef(null);
  const adapter = useMemo(() => {
    if (!map) return null;
    const handlers = [map.dragging, map.touchZoom, map.doubleClickZoom, map.boxZoom, map.scrollWheelZoom, map.keyboard];
    return {
      container: map.getContainer(),
      project: point => map.latLngToContainerPoint([point.lat, point.lng]),
      unproject: point => { const p = map.containerPointToLatLng([point.x, point.y]); return { lng: ((p.lng + 180) % 360 + 360) % 360 - 180, lat: Math.max(-85, Math.min(85, p.lat)) }; },
      isMarker: (_, target) => Boolean(target.closest?.('.leaflet-marker-icon,.discovery-result-marker')),
      suspendNavigation: () => { map.stop(); const state = handlers.map(handler => handler.enabled()); handlers.forEach(handler => handler.disable()); return state; },
      restoreNavigation: state => handlers.forEach((handler, i) => { if (state[i]) handler.enable(); }),
      subscribe: listener => { map.on('move zoom resize', listener); return () => map.off('move zoom resize', listener); },
    };
  }, [map]);
  useEffect(() => {
    if (!map) return;
    areaLayer.current = L.layerGroup().addTo(map); resultLayer.current = L.layerGroup().addTo(map);
    return () => { areaLayer.current?.remove(); resultLayer.current?.remove(); areaLayer.current = null; resultLayer.current = null; };
  }, [map]);
  useEffect(() => {
    const layer = areaLayer.current; if (!layer) return;
    layer.clearLayers();
    if (area) L.geoJSON(areaFeature(area), { interactive: false, style: { color: '#b46a00', weight: 3, dashArray: '9 6', fillColor: '#e59b19', fillOpacity: .12 } }).addTo(layer);
  }, [area, map]);
  useEffect(() => {
    const layer = resultLayer.current; if (!layer) return;
    layer.clearLayers();
    for (const row of results) {
      const label = document.createElement('span'); label.textContent = row.company;
      L.circleMarker([row.lat, row.lng], { radius: 8, color: '#fffdf4', weight: 2, fillColor: row.duplicate ? '#788d8a' : '#eb961c', fillOpacity: 1, className: 'discovery-result-marker' })
        .bindTooltip(label).on('click', () => current.current.onPick(row.id)).addTo(layer);
    }
  }, [results, map]);
  return adapter;
}
