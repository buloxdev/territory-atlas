import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { DEMO_LOCATIONS, parseBackup } from './locations.js';
import { readWorkspace, readTerritory, writeWorkspace } from './workspace.js';
import { prepareImportRows, readImportTable } from './import.js';
import './launch.css';
import DemoPreview from './DemoPreview.jsx';
import TomTomKeySteps from './TomTomKeySteps.jsx';

const TerritoryContext = createContext(null);
export const useTerritory = () => useContext(TerritoryContext);

function download(value, name, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog ref={ref} className="launch-dialog" aria-labelledby="launch-dialog-title" onCancel={onClose}>
    <header><h2 id="launch-dialog-title">{title}</h2><button onClick={onClose} aria-label="Close dialog">×</button></header>
    {children}
  </dialog>;
}

function ImportGuide({ kind, targetLocations, onApply, onClose }) {
  const [preview, setPreview] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const restoring = kind === 'restore';
  async function readFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(''); setPreview(null); setBusy(true);
    try {
      if (file.size > 10 * 1024 * 1024) throw Error('Choose a file smaller than 10 MB. Split large spreadsheets into smaller files.');
      if (restoring) {
        if (!file.name.toLowerCase().endsWith('.json')) throw Error('Choose a Territory Atlas JSON backup.');
        setPreview({ name: file.name, locations: parseBackup(JSON.parse(await file.text())) });
      } else {
        const rows = await prepareImportRows(await readImportTable(file), targetLocations, file.name);
        setPreview({ name: file.name, rows });
      }
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); event.target.value = ''; }
  }
  const ready = preview?.rows?.filter(row => row.outcome === 'ready') || [];
  return <Modal title={restoring ? 'Restore a backup' : 'Import your accounts'} onClose={onClose}>
    {restoring ? <p>A backup is a JSON file downloaded from Territory Atlas. Restoring replaces your saved territory with the locations in that file. Download a backup first if you want to keep the current territory.</p> : <>
      <p>Choose an Excel (.xlsx) or CSV spreadsheet. Use these four columns in the first row, in any order.</p>
      <div className="launch-table"><table><thead><tr><th>Account</th><th>Relationship Status</th><th>City</th><th>ST</th></tr></thead><tbody><tr><td>Your company</td><td>Customer</td><td>Chicago</td><td>IL</td></tr><tr><td>Another company</td><td>Prospect</td><td>Indianapolis</td><td>IN</td></tr></tbody></table></div>
      <p>Use Customer or Prospect and a two-letter U.S. state abbreviation. Locations start at city centers; review the exact facility address before a visit.</p>
      <a className="launch-link" href={`${import.meta.env.BASE_URL}accounts-template.csv`} download>Download spreadsheet template (CSV)</a>
      <p className="launch-muted">Open the template in Excel, replace the example rows, and save as .xlsx or .csv. Demo accounts are kept separate from your territory.</p>
    </>}
    <label className="launch-file">{busy ? 'Reading file…' : restoring ? 'Choose JSON backup' : 'Choose spreadsheet'}<input type="file" accept={restoring ? '.json,application/json' : '.csv,.xlsx'} disabled={busy} onChange={readFile}/></label>
    {error && <p className="launch-error" role="alert">{error}</p>}
    {preview && <section aria-label="File review">
      <h3>{preview.name}</h3>
      {restoring ? <p>{preview.locations.length} locations will replace {targetLocations.length} saved locations. {preview.locations.length === 0 && 'This backup will empty your territory.'}</p> : <>
        <p>{ready.length} ready · {preview.rows.filter(row => row.outcome === 'duplicate').length} duplicates · {preview.rows.filter(row => row.outcome === 'invalid').length} invalid</p>
        <div className="launch-table"><table><thead><tr><th>Row</th><th>Account</th><th>Location</th><th>Result</th></tr></thead><tbody>{preview.rows.map(row => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.account || '—'}</td><td>{row.city}, {row.state}</td><td>{row.message}</td></tr>)}</tbody></table></div>
        <p>Only ready rows will be added to your {targetLocations.length} saved locations. Fix invalid rows in your spreadsheet and import them again. Duplicate rows are skipped.</p>
      </>}
      <button className="launch-primary" disabled={!restoring && !ready.length} onClick={() => onApply(restoring ? preview.locations : [...targetLocations, ...ready.map(row => row.location)])}>{restoring ? 'Replace territory with backup' : `Import ${ready.length} locations`}</button>
    </section>}
    <p className="launch-muted">Nothing changes until you confirm. Your file is processed in this browser.</p>
  </Modal>;
}

function Privacy() {
  return <>
    <p>Territory Atlas is free, open-source software. No Territory Atlas account is required, and the app has no customer database or application analytics.</p>
    <h3>Saved on this browser</h3><p>Your accounts and edits are stored on this site in this browser. They do not sync to other devices. Clearing site data or using private browsing can remove them. Download backups regularly. A new website address has separate storage: export from the old site and restore on the new one.</p>
    <h3>External services</h3><p>Map tiles and styles come from OpenStreetMap and OpenFreeMap. Fonts come from Google Fonts. These services receive ordinary request information and the map areas you view. Spreadsheet imports use a bundled U.S. city index and do not send your account records to a search provider.</p>
    <p>If address lookup is enabled by the site operator, adding or changing an address sends it to the configured geocoding provider. You can enter latitude and longitude instead.</p>
    <h3>Optional business search</h3><p>TomTom requires your own account and Places Search API key. The drawn area, search terms, and key go to TomTom; your saved account list does not. The key lasts for this tab's session and is excluded from backups. Disconnect removes it. TomTom has its own pricing and terms. Results are temporary previews and are not included in your territory backups.</p>
    <p>Geofabrik is an alternative for existing paid Overpass accounts. Its requests include the area, search filters, and provider key. Accounts you explicitly add from that provider become part of your saved territory.</p>
    <p>The software is provided under the MIT license. Provider services and data retain their own terms.</p>
    {import.meta.env.VITE_PUBLIC_RELEASE === 'true' && <p><a href={`${import.meta.env.BASE_URL}LICENSE`}>MIT license</a> · <a href={`${import.meta.env.BASE_URL}THIRD_PARTY_NOTICES.md`}>Third-party notices</a></p>}
    {import.meta.env.VITE_PUBLIC_RELEASE === 'true' && <a className="launch-link" href={`${import.meta.env.BASE_URL}territory-atlas-source.zip`} download>Download open-source code</a>}
  </>;
}

export default function LaunchApp({ children }) {
  const [workspace, setWorkspace] = useState(() => {
    try { return { ...readWorkspace(localStorage), error: '' }; }
    catch { return { mode: null, locations: [], error: 'Saved data could not be opened. Restore a backup to recover it, or check that browser storage is available. Existing stored data has not been replaced.' }; }
  });
  const [modal, setModal] = useState(null), [target, setTarget] = useState([]), [menu, setMenu] = useState(false);
  const { mode, locations, error } = workspace;
  useEffect(() => {
    if (!mode) return;
    try { writeWorkspace(localStorage, mode, locations); setWorkspace(current => current.error ? { ...current, error: '' } : current); }
    catch { setWorkspace(current => ({ ...current, error: 'Changes are only in memory. Browser storage is unavailable or full. Download a backup before leaving this page.' })); }
  }, [mode, locations]);
  function ownTerritory() {
    try { return mode === 'territory' ? locations : readTerritory(localStorage); }
    catch { throw Error('Your saved territory could not be read. Restore a backup before importing accounts.'); }
  }
  function openImport(kind = 'import') {
    try { setTarget(ownTerritory()); setModal(kind); }
    catch (failure) {
      if (kind === 'restore') { setTarget([]); setModal(kind); }
      else setWorkspace(current => ({ ...current, error: failure.message }));
    }
  }
  function start(nextMode) {
    try { setWorkspace({ mode: nextMode, locations: nextMode === 'demo' ? DEMO_LOCATIONS : ownTerritory(), error: '' }); setMenu(false); }
    catch (failure) { setWorkspace(current => ({ ...current, error: failure.message })); }
  }
  const backup = () => download(JSON.stringify(locations, null, 2), `territory-atlas-${mode === 'demo' ? 'demo-' : ''}${new Date().toISOString().slice(0, 10)}.json`);
  const welcome = <div className="launch-welcome"><div className="launch-hero"><div className="launch-intro"><span className="launch-eyebrow">TERRITORY ATLAS · FREE & OPEN SOURCE</span><h1>Your accounts.<br/>Your territory.</h1><p>Turn your spreadsheet into a map. See customers and prospects, explore nearby businesses, and plan your next visit.</p><p className="launch-muted">No login. Your accounts stay saved in this browser.</p><DemoPreview onOpen={() => start('demo')}/></div><div className="launch-choices">
    <button onClick={() => start('demo')}><strong>Try the demo <span>↗</span></strong><small>Explore ten fictional accounts. Your territory stays separate.</small></button>
    <button onClick={() => openImport()}><strong>Import your accounts <span>↗</span></strong><small>Upload Excel or CSV. Get a template and review every row.</small></button>
    <button onClick={() => openImport('restore')}><strong>Restore a backup <span>↗</span></strong><small>Bring your saved territory from another browser or device.</small></button>
    <button className="launch-link" onClick={() => start('territory')}>Open my territory{mode ? '' : ' / start empty'}</button>
    {mode && <button className="launch-link" onClick={() => setMenu(false)}>Return to map</button>}
    <p className="launch-muted">TomTom search is optional and uses your own API key. The map, imports, and backups work without one.</p><button className="launch-link" onClick={() => setModal('privacy')}>Privacy & data</button>
  </div></div>
    <section className="launch-key-guide" aria-labelledby="tomtom-guide-title"><div><span className="launch-eyebrow">OPTIONAL BUSINESS SEARCH</span><h2 id="tomtom-guide-title">Get a TomTom key in four steps.</h2><p>The map, imports, and backups work without a key. Connect your own key when you want to search for nearby businesses.</p></div><TomTomKeySteps/></section>
  </div>;
  return <TerritoryContext.Provider value={{ locations, mode, setLocations: updater => setWorkspace(current => ({ ...current, locations: typeof updater === 'function' ? updater(current.locations) : updater })), openImport, backup }}>
    <div className="launch-root">
      {(mode && !menu) && <nav className="launch-toolbar" aria-label="Territory tools"><span>{error ? 'Not saved — download a backup' : mode === 'demo' ? 'Demo workspace · separate from your accounts' : 'Saved in this browser'}</span><div><button onClick={() => setMenu(true)}>Get started</button><button onClick={() => openImport()}>Import</button><button onClick={backup}>Backup</button><button onClick={() => openImport('restore')}>Restore</button><button onClick={() => setModal('privacy')}>Privacy & data</button></div></nav>}
      {error && <p className="launch-storage-error" role="alert">{error}{mode && <button onClick={backup}>Download backup</button>}</p>}
      {!mode || menu ? welcome : <div className="launch-map" key={mode}>{children}</div>}
    </div>
    {modal === 'privacy' && <Modal title="Privacy & your data" onClose={() => setModal(null)}><Privacy/></Modal>}
    {['import', 'restore'].includes(modal) && <ImportGuide kind={modal} targetLocations={target} onClose={() => setModal(null)} onApply={incoming => { setWorkspace({ mode: 'territory', locations: incoming, error: '' }); setMenu(false); setModal(null); }}/>} 
  </TerritoryContext.Provider>;
}
