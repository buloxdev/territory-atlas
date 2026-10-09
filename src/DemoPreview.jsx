import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { DEMO_LOCATIONS } from './locations.js';

export default function DemoPreview({ onOpen }) {
  const host = useRef(null);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    const map = L.map(host.current, { scrollWheelZoom: false, zoomControl: true, minZoom: 3 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
    }).on('tileerror', () => setTileError(true)).addTo(map);
    for (const location of DEMO_LOCATIONS) {
      const label = document.createElement('div');
      const company = document.createElement('strong'); company.textContent = location.company;
      const details = document.createElement('div'); details.textContent = `${location.status} · ${location.city}, ${location.state}`;
      label.append(company, details);
      L.circleMarker([location.lat, location.lng], { radius: 6, color: '#ffffff', weight: 2, fillColor: location.status === 'Customer' ? '#ffffff' : '#0b2a5b', fillOpacity: 1 }).bindPopup(label).addTo(map);
    }
    map.fitBounds(DEMO_LOCATIONS.map(location => [location.lat, location.lng]), { padding: [30, 30], maxZoom: 6 });
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(host.current);
    return () => { observer.disconnect(); map.remove(); };
  }, []);
  return <section className="launch-demo" aria-labelledby="demo-preview-title">
    <header><div><span className="launch-eyebrow">TAKE A LOOK</span><h2 id="demo-preview-title">A spreadsheet becomes a territory.</h2></div><button className="launch-link" onClick={onOpen}>Open the full demo ↗</button></header>
    <div ref={host} className="launch-demo-map" aria-label="Interactive preview of ten fictional customer and prospect locations"/>
    <footer><span><i className="demo-customer"/> Customers <i className="demo-prospect"/> Prospects</span><span>10 fictional accounts · city centers · click a pin to explore</span></footer>
    {tileError && <p className="launch-muted" role="status">Some preview tiles could not load. You can still open the full demo.</p>}
  </section>;
}
