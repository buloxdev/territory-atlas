import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import Building2 from 'lucide-react/dist/esm/icons/building-2.mjs';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left.mjs';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.mjs';
import Download from 'lucide-react/dist/esm/icons/download.mjs';
import LocateFixed from 'lucide-react/dist/esm/icons/locate-fixed.mjs';
import MapPin from 'lucide-react/dist/esm/icons/map-pin.mjs';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import Search from 'lucide-react/dist/esm/icons/search.mjs';
import Upload from 'lucide-react/dist/esm/icons/upload.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import 'leaflet/dist/leaflet.css';
import './styles.css';
// Keep all map CSS ahead of Blueprint, even when the 3D JavaScript loads later.
import 'maplibre-gl/dist/maplibre-gl.css';
import './atlas3d.css';

import LaunchApp, { useTerritory } from './LaunchApp.jsx';
import { geocodeAddress } from './geocoding.js';
import DiscoveryPanel from './DiscoveryPanel.jsx';
import AreaControls from './AreaControls.jsx';
import useLeafletDiscoveryMap from './useLeafletDiscoveryMap.js';
import { mergeDiscoveredLocations } from './discovery.js';
import { Crosshair, Ruler, SheetHead } from './Blueprint.jsx';
import { AccountRow, AccountDetails, isLocationVerified } from './AccountPresentation.jsx';
import { hasMapCoordinates } from './coordinates.js';
import './blueprint.css';

const Atlas3D = lazy(() => import('./Atlas3D.jsx'));

class MapLoadBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <div className="bp-map-loading" role="alert">The 3D map could not load. <a href="?view=3d">Try again</a><a href="?view=2d">Open 2D map</a></div>
      : this.props.children;
  }
}

// Blueprint ink: customers are solid white, prospects a lighter drafting blue drawn hollow.
const COLORS = {
  Customer: '#ffffff',
  Prospect: '#8fb6ec',
};

const LOCATION_TYPES = [
  'Corporate HQ',
  'Distribution Center',
  'Warehouse',
  'Manufacturing Plant',
  'Decision Maker Location',
  'Home Office',
  'Contact Office',
  'Imported Location',
];

function markerIcon(location, selected) {
  const color = COLORS[location.status] || COLORS.Prospect;
  return L.divIcon({
    className: 'terminal-marker-wrap',
    html: `<span class="terminal-marker is-${location.status === 'Customer' ? 'customer' : 'prospect'} ${selected ? 'is-selected' : ''}" style="--marker:${color}"><i></i></span>`,
    iconSize: selected ? [34, 34] : [26, 26],
    iconAnchor: selected ? [17, 17] : [13, 13],
  });
}

function NetworkMap({ locations, selectedId, onSelect, fitSignal, layoutSignal, onMapReady }) {
  const host = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selected = locations.find((location) => location.id === selectedId);

  useEffect(() => {
    const map = L.map(host.current, {
      center: [39.5, -98.35], zoom: 4, minZoom: 3, zoomControl: false,
    });
    mapRef.current = map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    onMapReady(map);
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = markersRef.current;
    if (!layer) return;
    layer.clearLayers();
    locations.filter(hasMapCoordinates).forEach((location) => {
      const label = document.createElement('div');
      const company = document.createElement('strong');
      company.textContent = location.company;
      const city = document.createElement('span');
      city.textContent = `${location.city}, ${location.state}`;
      label.append(company, city);
      L.marker([location.lat, location.lng], {
        icon: markerIcon(location, selectedId === location.id),
        zIndexOffset: selectedId === location.id ? 1000 : 0,
      }).bindTooltip(label, { direction: 'top', offset: [0, -13], opacity: 1 })
        .on('click', () => onSelectRef.current(location.id)).addTo(layer);
    });
  }, [locations, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (selected && hasMapCoordinates(selected) && map) {
      map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 8), { duration: 0.8 });
    }
  }, [selected]);

  useEffect(() => {
    const placed = locations.filter(hasMapCoordinates);
    if (!placed.length || !mapRef.current) return;
    const bounds = L.latLngBounds(placed.map((location) => [location.lat, location.lng]));
    mapRef.current.fitBounds(bounds, { padding: [72, 72], maxZoom: 7, animate: true, duration: 0.8 });
  }, [fitSignal]);

  useEffect(() => {
    const timer = window.setTimeout(() => mapRef.current?.invalidateSize({ pan: false }), 320);
    return () => window.clearTimeout(timer);
  }, [layoutSignal]);

  return <div ref={host} className="map" aria-label="Customer and prospect map" />;
}

const EMPTY_LOCATION_FORM = { company: '', status: 'Prospect', locationType: 'Corporate HQ', address: '', city: '', state: '', lat: '', lng: '', verificationStatus: 'Needs review' };

function LocationDrawer({ open, onClose, onSave, initialLocation }) {
  const [form, setForm] = useState(() => initialLocation ? {
    company: initialLocation.company,
    status: initialLocation.status,
    locationType: initialLocation.locationType,
    address: initialLocation.address,
    city: initialLocation.city, state: initialLocation.state, lat: String(initialLocation.lat), lng: String(initialLocation.lng),
    verificationStatus: isLocationVerified(initialLocation) ? 'Verified' : 'Needs review',
  } : EMPTY_LOCATION_FORM);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const isEditing = Boolean(initialLocation);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setWorking(true);
    try {
      const address = form.address.trim();
      if (!form.company.trim() || !address) throw Error('Enter a company name and facility address.');
      const addressChanged = !initialLocation || address !== initialLocation.address.trim();
      let geographicFields = initialLocation ? {
        city: initialLocation.city,
        state: initialLocation.state,
        lat: initialLocation.lat,
        lng: initialLocation.lng,
      } : null;

      const hasCoordinates = String(form.lat).trim() !== '' || String(form.lng).trim() !== '';
      if (hasCoordinates) {
        const lat = Number(form.lat), lng = Number(form.lng);
        if (String(form.lat).trim() === '' || String(form.lng).trim() === '' || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) throw Error('Enter both latitude (−85 to 85) and longitude (−180 to 180).');
        geographicFields = { lat, lng, city: form.city.trim(), state: form.state.trim().toUpperCase() };
      } else if (addressChanged) {
        const configResponse = await fetch(`${import.meta.env.BASE_URL}geocoding-config.json`, { cache: 'no-cache' });
        if (!configResponse.ok) throw new Error('Address search configuration could not be loaded.');
        const config = await configResponse.json();
        if (!config.endpoint || typeof config.endpoint !== 'string') throw new Error('Automatic address lookup is not enabled on this site. Enter the facility latitude and longitude below, or import its city from a spreadsheet.');
        const results = await geocodeAddress(address, config.endpoint);
        if (!results.length) throw new Error('Address not found. Try including city, state, and ZIP.');
        const hit = results[0];
        geographicFields = {
          city: hit.address?.city || hit.address?.town || hit.address?.village || hit.address?.county || '',
          state: hit.address?.['ISO3166-2-lvl4']?.replace('US-', '') || hit.address?.state || '',
          lat: Number(hit.lat),
          lng: Number(hit.lon),
        };
      }

      onSave({
        ...initialLocation,
        id: initialLocation?.id || `local-${Date.now()}`,
        company: form.company.trim(),
        status: form.status,
        locationType: form.locationType.trim() || 'Corporate HQ',
        verificationStatus: form.verificationStatus,
        address,
        ...geographicFields,
        source: initialLocation?.source || 'Manual entry',
      });
      onClose();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className={`drawer-shell ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <button className="drawer-scrim" onClick={onClose} aria-label="Close location editor" />
      <aside className="drawer">
        <header>
          <div>
            <span className="eyebrow">{isEditing ? 'UPDATE MAP POINT' : 'NEW MAP POINT'}</span>
            <h2>{isEditing ? 'Edit location' : 'Add location'}</h2>
          </div>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </header>
        <form onSubmit={submit}>
          <label>
            <span>Company</span>
            <input required value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="Company name" />
          </label>
          <div className="field-pair">
            <label>
              <span>Relationship</span>
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option>Prospect</option>
                <option>Customer</option>
              </select>
            </label>
            <label>
              <span>Location type</span>
              <select value={form.locationType} onChange={(event) => setForm({ ...form, locationType: event.target.value })}>
                {!LOCATION_TYPES.includes(form.locationType) && <option>{form.locationType}</option>}
                {LOCATION_TYPES.map((locationType) => <option key={locationType}>{locationType}</option>)}
              </select>
            </label>
          </div>
          <label>
            <span>Facility or office address</span>
            <textarea required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Street, city, state, ZIP" rows="3" />
          </label>
          <details className="coordinate-fields" open>
            <summary>Map coordinates</summary>
            <p className="form-hint">Enter latitude and longitude to place a facility directly, without sending its address to a search service. Clear both to use address lookup if enabled by this site.</p>
            <div className="field-pair"><label><span>Latitude</span><input type="number" step="any" min="-85" max="85" value={form.lat} onChange={event => setForm({ ...form, lat: event.target.value })} placeholder="41.8781"/></label><label><span>Longitude</span><input type="number" step="any" min="-180" max="180" value={form.lng} onChange={event => setForm({ ...form, lng: event.target.value })} placeholder="-87.6298"/></label></div>
            <div className="field-pair"><label><span>City</span><input value={form.city} onChange={event => setForm({ ...form, city: event.target.value })}/></label><label><span>State</span><input maxLength={2} value={form.state} onChange={event => setForm({ ...form, state: event.target.value })} placeholder="IL"/></label></div>
          </details>
          <label>
            <span>Location verification</span>
            <select value={form.verificationStatus} onChange={(event) => setForm({ ...form, verificationStatus: event.target.value })}>
              <option>Needs review</option>
              <option>Verified</option>
            </select>
          </label>
          <p className="form-hint">Coordinates determine where this marker appears. Review them before marking the location verified.</p>
          <p className="form-hint">Automatic lookup, when enabled, sends the address to the site’s configured search provider. Use public facility addresses. <a href="https://operations.osmfoundation.org/policies/nominatim/" target="_blank" rel="noreferrer">Usage policy</a></p>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button wide" disabled={working}>
            {working ? 'SAVING…' : isEditing ? 'SAVE CHANGES' : 'LOCATE + ADD'} <ChevronRight size={16} />
          </button>
        </form>
      </aside>
    </div>
  );
}

function App() {
  const { locations, setLocations, openImport, backup } = useTerritory();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [reviewOnly, setReviewOnly] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [ledgerCollapsed, setLedgerCollapsed] = useState(() => { try { return localStorage.getItem('freight-network-ledger-collapsed') === 'true'; } catch { return false; } });
  const [fitSignal, setFitSignal] = useState(0);
  const [leafletMap, setLeafletMap] = useState(null);
  const [discoveryOpen, setDiscoveryOpen] = useState(false), [area, setArea] = useState(null), [drawing, setDrawing] = useState(false);
  const [discoveryResults, setDiscoveryResults] = useState([]), [activeResult, setActiveResult] = useState(null), [shapeError, setShapeError] = useState('');
  const areaBeforeDrawing = useRef(null);
  const focusDiscovered = row => {
    setSelectedId(null); setActiveResult(row.id);
    leafletMap?.flyTo([row.lat, row.lng], Math.max(leafletMap.getZoom(), 13), { animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches });
  };
  const discoveryAdapter = useLeafletDiscoveryMap(leafletMap, { area, results: discoveryResults, onPick: id => {
    const row = discoveryResults.find(item => item.id === id); if (row) focusDiscovered(row);
  } });
  const startAreaDrawing = (mode = 'circle') => {
    areaBeforeDrawing.current = area; leafletMap?.stop(); setSelectedId(null); setShapeError(''); setDrawing(mode);
  };
  const removeBusinessSearchArea = () => { areaBeforeDrawing.current = null; setArea(null); setDrawing(false); setDiscoveryResults([]); setShapeError(''); setActiveResult(null); };
  const closeBusinessSearch = () => { setDiscoveryOpen(false); removeBusinessSearchArea(); };
  const addDiscovered = rows => {
    const result = mergeDiscoveredLocations(locations, rows);
    setLocations(result.locations); return result;
  };


  useEffect(() => {
    try { localStorage.setItem('freight-network-ledger-collapsed', String(ledgerCollapsed)); } catch { /* Panel preference is optional. */ }
  }, [ledgerCollapsed]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return locations.filter((location) => {
      const matchesStatus = status === 'All' || location.status === status;
      const matchesReview = !reviewOnly || (location.status === 'Customer' && !isLocationVerified(location));
      const haystack = `${location.company} ${location.city} ${location.state} ${location.address}`.toLowerCase();
      return matchesStatus && matchesReview && (!needle || haystack.includes(needle));
    });
  }, [locations, search, status, reviewOnly]);

  const selected = locations.find((location) => location.id === selectedId);
  const customerCount = locations.filter((location) => location.status === 'Customer').length;
  const prospectCount = locations.filter((location) => location.status === 'Prospect').length;
  const customerReviewCount = locations.filter((location) => location.status === 'Customer' && !isLocationVerified(location)).length;

  useEffect(() => {
    if (selectedId && !filtered.some(location => location.id === selectedId)) setSelectedId(null);
  }, [filtered, selectedId]);

  function saveLocation(location) {
    setLocations((current) => current.some((item) => item.id === location.id)
      ? current.map((item) => item.id === location.id ? location : item)
      : [...current, location]);
    setSelectedId(location.id);
  }

  function openAddLocation() {
    setEditingLocation(null);
    setDrawerOpen(true);
  }

  function openEditLocation() {
    setEditingLocation(selected);
    setDrawerOpen(true);
  }

  function deleteSelectedLocation() {
    if (!selected) return;
    const confirmed = window.confirm(
      `Delete ${selected.company} — ${selected.city}, ${selected.state}?\n\nThis removes only this location from the map.`,
    );
    if (!confirmed) return;
    setLocations((current) => current.filter((location) => location.id !== selected.id));
    setSelectedId(null);
  }

  function closeLocationDrawer() {
    setDrawerOpen(false);
    setEditingLocation(null);
  }

  function selectLocation(id) {
    setSelectedId(id);
  }

  return (
    <main className="app-shell">
      <header className="command-bar">
        <div className="brand-block">
          <span className="brand-mark"><Crosshair /></span>
          <div>
            <strong>Territory Atlas</strong>
            <small>DWG TA-003 · MANAGE LOCATIONS</small>
          </div>
        </div>
        <div className="market-line">
          <span><i className="pulse-dot" /> LOCAL DATA</span>
          <span>{locations.length.toString().padStart(2, '0')} LOCATIONS</span>
          <span>CUSTOMERS + PROSPECTS</span>
        </div>
        <div className="header-actions">
          <a className="text-button" href="?view=3d">3D MAP</a>
          <button className="text-button" onClick={() => openImport()}><Upload size={15} /> IMPORT</button>
          <button className="text-button" onClick={backup}><Download size={15} /> BACKUP</button>
          <button className="primary-button" onClick={openAddLocation}><Plus size={16} /> ADD LOCATION</button>
        </div>
      </header>

      <Ruler />

      <section className={`workspace ${ledgerCollapsed && !discoveryOpen ? 'is-ledger-collapsed' : ''} ${discoveryOpen ? 'is-discovering' : ''}`}>
        <aside className="ledger">
          {discoveryOpen ? <DiscoveryPanel area={area} drawing={drawing} ready={Boolean(leafletMap)} locations={locations} onDraw={startAreaDrawing} onCancelDraw={() => { setArea(areaBeforeDrawing.current); setDrawing(false); }} onAreaChange={setArea} onRemoveArea={removeBusinessSearchArea} onResults={setDiscoveryResults} onFocus={focusDiscovered} onAdd={addDiscovered} onClose={closeBusinessSearch} activeResult={activeResult} shapeError={shapeError}/> : <>
          <div className="ledger-top">
            <div className="ledger-label-row">
              <SheetHead number="SHEET 2" title="Account schedule" note={`${String(locations.length).padStart(2, '0')} LOC`} as="p" />
              <button className="ledger-collapse" onClick={() => setLedgerCollapsed(true)} aria-label="Hide location panel" title="Hide location panel"><ChevronLeft size={15} /></button>
            </div>
            <button className="atlas-discover-button" disabled={!leafletMap} onClick={() => { setDiscoveryOpen(true); setSelectedId(null); }}>Find nearby businesses</button>
            <p className="account-storage-note">Import once. Your accounts stay saved in this browser when you refresh or return to the same site. Use Backup to keep a copy or move to another browser or device; clearing site storage removes saved accounts.</p>
            <div className="search-field">
              <Search size={15} />
              <input aria-label="Search accounts" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="SEARCH COMPANY OR CITY" />
              {search && <button aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></button>}
            </div>
            <div className="status-tabs">
              {['All', 'Customer', 'Prospect'].map((item) => (
                <button key={item} aria-pressed={status === item && !reviewOnly} className={status === item && !reviewOnly ? 'active' : ''} onClick={() => { setStatus(item); setReviewOnly(false); }}>
                  {item}
                  <b>{item === 'All' ? locations.length : item === 'Customer' ? customerCount : prospectCount}</b>
                </button>
              ))}
            </div>
            <button
              className={`verification-toggle ${reviewOnly ? 'active' : ''}`}
              onClick={() => {
                setReviewOnly((current) => !current);
                if (!reviewOnly) setStatus('Customer');
              }}
            >
              <span><i /> NEEDS VERIFICATION</span>
              <b>{customerReviewCount}</b>
            </button>
          </div>

          <div className="atlas-location-list">
            {filtered.map((location, index) => (
              <AccountRow
                key={location.id}
                location={location}
                index={index}
                selected={selectedId === location.id}
                onSelect={() => selectLocation(location.id)}
              />
            ))}
            {!filtered.length && <div className="empty-state">NO MATCHING LOCATIONS</div>}
          </div>

          <footer className="ledger-footer">
            <span><i style={{ background: COLORS.Customer }} /> CUSTOMER</span>
            <span><i style={{ background: COLORS.Prospect }} /> PROSPECT</span>
          </footer>
          </>}
        </aside>

        <section className={`map-stage ${ledgerCollapsed && !discoveryOpen ? 'has-collapsed-ledger' : ''}`}>
          <NetworkMap locations={filtered} selectedId={selectedId} onSelect={selectLocation} fitSignal={fitSignal} layoutSignal={`${ledgerCollapsed}-${discoveryOpen}`} onMapReady={setLeafletMap} />
          <AreaControls adapter={discoveryAdapter} area={area} drawing={drawing} enabled={discoveryOpen} onAreaChange={setArea} onDrawingChange={setDrawing} onError={setShapeError}/>
          {drawing && <div className="discovery-map-instruction" role="status">{drawing === 'freehand' ? 'Trace an outline; release to close it' : 'Drag from the center to the edge'}<br/><small>Esc cancels</small></div>}
          <div className="map-grid" />
          {ledgerCollapsed && !discoveryOpen && <button className="ledger-reopen" onClick={() => setLedgerCollapsed(false)} aria-label="Show location panel" title="Show location panel"><ChevronRight size={16} /></button>}
          <div className="map-heading">
            <SheetHead number="SHEET 3" title="Network view" as="p" />
            <strong>USA / ACCOUNT LOCATIONS</strong>
          </div>
          <button className="fit-button" onClick={() => setFitSignal((value) => value + 1)}>
            <LocateFixed size={16} /> FIT {filtered.length} POINTS
          </button>
          <div className="coordinates">39.8283° N&nbsp;&nbsp; 98.5795° W</div>

          {selected && !discoveryOpen && (
            <AccountDetails location={selected} onClose={() => setSelectedId(null)} actions={[
              { label: 'Edit location', onClick: openEditLocation },
              { label: 'Delete location', onClick: deleteSelectedLocation },
            ]}>
              <div className="source-links">
                {selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noreferrer">VIEW SOURCE <ChevronRight size={13} /></a>}
                {selected.verifiedUrl && <a href={selected.verifiedUrl} target="_blank" rel="noreferrer">VERIFY LOCATION <ChevronRight size={13} /></a>}
              </div>
            </AccountDetails>
          )}
        </section>
      </section>

      <footer className="system-bar">
        <span><Building2 size={13} /> YOUR TERRITORY AT A GLANCE</span>
        <span><MapPin size={13} /> CUSTOMERS + PROSPECTS</span>
        <span className="system-ready">SYSTEM READY <i /></span>
      </footer>

      {drawerOpen && <LocationDrawer open onClose={closeLocationDrawer} onSave={saveLocation} initialLocation={editingLocation} />}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<LaunchApp>{new URLSearchParams(window.location.search).get('view') === '2d' ? <App /> : <MapLoadBoundary><Suspense fallback={<div className="bp-map-loading" role="status">Loading the 3D map… <a href="?view=2d">Open 2D map</a></div>}><Atlas3D /></Suspense></MapLoadBoundary>}</LaunchApp>);
