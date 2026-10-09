import { useEffect, useRef, useState } from 'react';
import { areaFeature } from './search-area.js';

const collection = features => ({ type: 'FeatureCollection', features });
export default function useDiscoveryMap(mapRef, ready, { area, results, onPick }) {
  const current = useRef(); current.current = { onPick };
  const [adapter, setAdapter] = useState(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.addSource('discovery-area', { type: 'geojson', data: collection([]) });
    map.addLayer({ id: 'discovery-fill', type: 'fill', source: 'discovery-area', paint: { 'fill-color': '#ffc857', 'fill-opacity': .12 } });
    map.addLayer({ id: 'discovery-outline', type: 'line', source: 'discovery-area', paint: { 'line-color': '#ffc857', 'line-width': 2, 'line-dasharray': [3, 2] } });
    map.addSource('discovery-results', { type: 'geojson', data: collection([]) });
    map.addLayer({ id: 'discovery-points', type: 'circle', source: 'discovery-results', paint: { 'circle-radius': 8, 'circle-color': ['case', ['get', 'duplicate'], '#7f9cc7', '#ffc857'], 'circle-stroke-width': 2, 'circle-stroke-color': '#0b2a5b' } });
    const pick = event => current.current.onPick(event.features[0].properties.id);
    map.on('click', 'discovery-points', pick);
    const handlers = [map.dragPan, map.touchZoomRotate, map.doubleClickZoom, map.boxZoom, map.dragRotate, map.scrollZoom, map.keyboard];
    setAdapter({
      container: map.getContainer(),
      project: point => map.project([point.lng, point.lat]),
      unproject: point => { const p = map.unproject([point.x, point.y]); return { lng: ((p.lng + 180) % 360 + 360) % 360 - 180, lat: Math.max(-85, Math.min(85, p.lat)) }; },
      isMarker: point => map.queryRenderedFeatures([point.x, point.y], { layers: ['prospect-points', 'prospect-clusters', 'discovery-points'] }).length > 0,
      suspendNavigation: () => { map.stop(); const state = handlers.map(handler => handler.isEnabled()); handlers.forEach(handler => handler.disable()); return state; },
      restoreNavigation: state => handlers.forEach((handler, i) => { if (state[i]) handler.enable(); }),
      subscribe: listener => { map.on('move', listener); map.on('resize', listener); return () => { map.off('move', listener); map.off('resize', listener); }; },
    });
    return () => {
      map.off('click', 'discovery-points', pick);
      for (const id of ['discovery-points', 'discovery-outline', 'discovery-fill']) if (map.getLayer(id)) map.removeLayer(id);
      for (const id of ['discovery-results', 'discovery-area']) if (map.getSource(id)) map.removeSource(id);
    };
  }, [ready, mapRef]);
  useEffect(() => {
    if (ready) mapRef.current?.getSource('discovery-area')?.setData(collection(area ? [areaFeature(area)] : []));
  }, [area, ready, mapRef]);
  useEffect(() => {
    if (ready) mapRef.current?.getSource('discovery-results')?.setData(collection(results.map(row => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [row.lng, row.lat] }, properties: { id: row.id, duplicate: row.duplicate } }))));
  }, [results, ready, mapRef]);
  return adapter;
}
