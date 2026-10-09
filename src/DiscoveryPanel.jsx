import React, { useEffect, useMemo, useRef, useState } from 'react';
import { containsPoint, isFreehand, METERS_PER_MILE } from './search-area.js';
import { DISCOVERY_CATEGORIES, parseDiscoveryRequest, prepareDiscoveredLocations, searchArea, clearDiscoveryCache } from './discovery.js';

import SearchProviderConnection from './SearchProviderConnection.jsx';
import { loadProviderConnection, providerRequest } from './search-provider.js';
import { TOMTOM_CATEGORIES } from './tomtom-search.js';

const EMPTY = [];
export default function DiscoveryPanel({ area, drawing, ready, locations, onDraw, onCancelDraw, onAreaChange, onResults, onFocus, onAdd, onClose, activeResult, shapeError }) {
  const [connection, setConnection] = useState(loadProviderConnection), [verified, setVerified] = useState(false);
  const [drawMode, setDrawMode] = useState(isFreehand(area) ? 'freehand' : 'circle');
  const [request, setRequest] = useState('Find manufacturers in this area');
  const [response, setResponse] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [selection, setSelection] = useState(new Set());
  const controller = useRef(null), requestVersion = useRef(0), retryAt = useRef(0);
  const category = useMemo(() => parseDiscoveryRequest(request, connection?.provider || 'tomtom'), [request, connection?.provider]);
  const rows = useMemo(() => response ? prepareDiscoveredLocations(response.data, response.area, response.categoryId, locations) : EMPTY, [response, locations]);
  const selectable = rows.filter(row => !row.duplicate && !row.previewOnly), selected = selectable.filter(row => selection.has(row.id));
  const tomtom = (response?.data.provider || connection?.provider || 'tomtom') === 'tomtom';
  const inArea = area ? locations.filter(item => containsPoint(area, item)).length : 0;
  useEffect(() => { onResults(rows); }, [rows, onResults]);
  useEffect(() => {
    requestVersion.current++; controller.current?.abort(); setBusy(false); setResponse(null); setSelection(new Set()); setError(''); setNotice('');
  }, [area, request, drawing, connection]);
  useEffect(() => { retryAt.current = 0; setVerified(false); clearDiscoveryCache(); }, [connection]);
  useEffect(() => () => { requestVersion.current++; controller.current?.abort(); onResults(EMPTY); }, [onResults]);

  async function search(event) {
    event.preventDefault();
    if (!area || !category || drawing || busy || !connection) return;
    if (Date.now() < retryAt.current) { setError(`The provider requested a pause. Try again in ${Math.ceil((retryAt.current - Date.now()) / 1000)} seconds.`); return; }
    controller.current?.abort(); controller.current = new AbortController();
    const version = ++requestVersion.current, signal = controller.current.signal;
    setBusy(true); setVerified(false); setError(''); setNotice(''); setResponse(null); setSelection(new Set());
    try {
      const provider = providerRequest(connection);
      const searchTarget = category.id === 'custom' ? category : category.id;
      const data = await searchArea(area, searchTarget, { ...provider, signal });
      // Validate before storing; partial responses must not look like empty searches.
      prepareDiscoveredLocations(data, area, searchTarget, locations);
      if (requestVersion.current === version) { setResponse({ data, area, categoryId: searchTarget }); setVerified(true); }
    } catch (failure) {
      if (requestVersion.current === version && !signal.aborted) {
        retryAt.current = Date.now() + (failure.retryAfterMs || 0);
        setError(failure.name === 'TimeoutError' ? 'The provider did not finish this search in time. Try a smaller area or contact provider support.' : failure.message === 'Failed to fetch' ? 'The business search service could not be reached. It may be unavailable or blocking browser requests. Try again later.' : failure.message);
      }
    } finally { if (requestVersion.current === version) setBusy(false); }
  }
  function toggle(id) { setSelection(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  function add() {
    try {
      const result = onAdd(selected);
      setSelection(new Set()); setNotice(result.added ? `Added ${result.added} ${result.added === 1 ? 'prospect' : 'prospects'} to your territory.` : 'These facilities are already in your territory.');
      setError('');
    } catch { setError('Your browser could not save these prospects. Export a backup in Manage locations and free up browser storage before trying again.'); }
  }
  return <div className="discovery-panel">
    <div className="discovery-heading"><div><div className="atlas-kicker">EXPAND YOUR TERRITORY</div><h1>Find nearby businesses.</h1></div><button aria-label="Close business search" onClick={onClose}>×</button></div>
    <div className="discovery-form">
      <p>Draw an area near your customers to find nearby businesses. Connect your own TomTom API key to search, or choose another provider below.</p>
      <small className="account-storage-note">Import once. Your accounts stay saved in this browser when you refresh or return to the same site. No need to import again for each search. Use Backup to keep a copy or move to another browser or device; clearing site storage removes saved accounts.</small>
      <SearchProviderConnection connection={connection} verified={verified} busy={busy} onChange={setConnection}/>
      <div className="discovery-shape-modes" aria-label="Search area shape">{['circle', 'freehand'].map(mode => <button type="button" key={mode} aria-pressed={drawMode === mode} disabled={Boolean(drawing) || busy} onClick={() => setDrawMode(mode)}>{mode === 'circle' ? 'Circle' : 'Freehand'}</button>)}</div>
      <button className="discovery-draw" disabled={!ready || busy} onClick={drawing ? onCancelDraw : () => onDraw(drawMode)}>{drawing ? 'Cancel drawing' : drawMode === 'freehand' ? isFreehand(area) ? 'Redraw freehand area' : 'Draw freehand area' : area && !isFreehand(area) ? 'Redraw circle' : 'Draw a circle'}</button>
      {drawing && <p className="discovery-instruction" role="status">{drawing === 'freehand' ? 'Press and trace an outline. Release to close it. Esc cancels.' : 'Drag from the center to the edge. On touch, tap the center, then the edge. Esc cancels.'}</p>}
      {area && !drawing && <p className="discovery-edit-hint">Drag inside the area or its center handle to move it. Drag an edge handle to resize. Focus a handle and use arrow keys for small adjustments. Esc cancels a drag.</p>}
      {shapeError && <p className="discovery-error" role="alert">{shapeError}</p>}
      {area && <>{isFreehand(area) ? <strong className="discovery-area-summary">Freehand area selected</strong> : <label className="discovery-radius">Radius <input aria-label="Search radius in miles" type="number" min="0.1" max="31.1" step="0.1" disabled={Boolean(drawing) || busy} value={+(area.radius / METERS_PER_MILE).toFixed(1)} onChange={event => { const miles = Number(event.target.value); if (miles >= 0.1 && miles <= 31.1) onAreaChange({ ...area, radius: Math.min(50000, miles * METERS_PER_MILE) }); }}/><span>mi</span></label>}<small className="discovery-area-summary">{inArea} saved {inArea === 1 ? 'location' : 'locations'} inside · within about 31 miles of center</small></>}
      <form onSubmit={search}><label htmlFor="discovery-request">What would you like to find?</label><textarea id="discovery-request" rows="2" maxLength={200} value={request} disabled={busy} onChange={event => setRequest(event.target.value)} placeholder={tomtom ? 'Plastic manufacturers or machine shops' : 'Find manufacturers in this area'}/>
        {tomtom && <small className="discovery-understood">Search by business name or type. The buttons below are shortcuts.</small>}
        <div className="discovery-examples" aria-label="Business category suggestions">{DISCOVERY_CATEGORIES.map(item => <button key={item.id} type="button" disabled={busy} aria-pressed={category?.id === item.id} onClick={() => setRequest(`Find ${item.label.toLowerCase()} in this area`)}>{item.label}</button>)}</div>
        {category ? <><small className="discovery-understood">Searching for: {category.label}</small>{tomtom && (category.keyword || TOMTOM_CATEGORIES[category.id]?.keyword) && <small className="discovery-understood">Keyword search inside your area; verify the business type. Employee count and revenue filters aren’t supported.</small>}</> : <p className="discovery-unsupported">{tomtom ? 'Enter a business name or type, such as plastic manufacturers or machine shops.' : 'Choose one of the categories above. This provider supports those business types; extra conditions such as employee count aren’t supported.'}</p>}
        <button className="discovery-submit" disabled={!area || !category || drawing || busy || !ready || !connection}>{busy ? 'Searching this area…' : !connection ? 'Set up search provider to search' : 'Find businesses'}</button>
        {busy && <button type="button" className="discovery-cancel" onClick={() => { requestVersion.current++; controller.current?.abort(); setBusy(false); }}>Cancel search</button>}
      </form>
      {error && <p className="discovery-error" role="alert">{error}</p>}
      {notice && <p className="discovery-notice" role="status">{notice}</p>}
    </div>
    {response && <div className="discovery-results-heading"><strong>{rows.length} mapped {rows.length === 1 ? 'match' : 'matches'}</strong>{!tomtom && <button onClick={() => setSelection(new Set(selection.size ? [] : selectable.map(row => row.id)))}>{selection.size ? 'Clear selection' : 'Select new matches'}</button>}</div>}
    <div className="discovery-results" aria-label="Discovered businesses" aria-busy={busy}>
      {response && !rows.length && <p className="discovery-empty">No facilities matched this area in {tomtom ? 'TomTom' : 'OpenStreetMap'}. {tomtom && response.categoryId?.id === 'custom' ? 'Try a shorter keyword, such as plastics, or a larger area.' : 'Try a different category or a larger area.'} An empty result doesn’t mean there are no businesses here.</p>}
      {(tomtom ? response?.data.results?.length >= 100 : response?.data.elements?.length >= 200) && <p className="discovery-empty">The source reached its {tomtom ? '100-result' : '200-feature'} limit. Use a smaller area for a more focused search.</p>}
      {rows.map(row => <article key={row.id} className={`discovery-result ${activeResult === row.id ? 'active' : ''}`}>
        <div className="discovery-result-title">{!row.previewOnly && <input type="checkbox" aria-label={`Select ${row.company}`} checked={!row.duplicate && selection.has(row.id)} disabled={row.duplicate} onChange={() => toggle(row.id)}/>}<button onClick={() => onFocus(row)}>{row.company}</button></div>
        <p>{row.address || 'Address not listed — verify the mapped facility.'}</p><small>{(row.distance / METERS_PER_MILE).toFixed(1)} mi from area center · {row.locationType}</small>
        <span className={`discovery-badge ${row.duplicate ? 'duplicate' : ''}`}>{row.duplicate ? 'Already in territory' : row.previewOnly ? 'TomTom preview · Verify facility' : 'Needs review'}</span>
        <div className="discovery-links">{row.sourceUrl && <a href={row.sourceUrl} target="_blank" rel="noreferrer">Map source ↗</a>}{row.website && <a href={row.website} target="_blank" rel="noreferrer">Website ↗</a>}</div>
      </article>)}
    </div>
    <div className="discovery-footer">{response && (tomtom ? <small>Preview only — these results are not saved to your territory or included in backups.</small> : <button className="discovery-submit" disabled={!selected.length} onClick={add}>Add selected prospects ({selected.length})</button>)}<small>{response ? <>Business locations from <a href={tomtom ? 'https://www.tomtom.com/en-gb/legal/' : 'https://www.openstreetmap.org/copyright'} target="_blank" rel="noreferrer">{tomtom ? '© TomTom' : '© OpenStreetMap contributors'}</a>. Coverage varies; confirm the facility before outreach.</> : 'Draw an area, connect your provider, and search. Review matches before outreach.'}</small></div>
  </div>;
}
