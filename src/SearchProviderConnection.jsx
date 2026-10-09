import React, { useState } from 'react';
import TomTomKeySteps from './TomTomKeySteps.jsx';
import { SEARCH_PROVIDER, SEARCH_PROVIDERS, createProviderConnection, saveProviderConnection, clearProviderConnection } from './search-provider.js';

export default function SearchProviderConnection({ connection, verified, busy, onChange }) {
  const [providerId, setProviderId] = useState(connection?.provider || SEARCH_PROVIDER.id);
  const provider = SEARCH_PROVIDERS[providerId];
  const [editing, setEditing] = useState(!connection), [key, setKey] = useState(''), [error, setError] = useState('');
  function apply(event) {
    event.preventDefault();
    try {
      const next = createProviderConnection(key, providerId);
      // The tab session is separate from territory storage, imports and backups.
      // If storage is unavailable, retain the key in memory for this page only.
      try { saveProviderConnection(next); } catch { /* Connection still works in memory. */ }
      onChange(next); setKey(''); setError(''); setEditing(false);
    } catch (failure) { setError(failure.message); }
  }
  function disconnect() {
    try { clearProviderConnection(); } catch { /* The in-memory connection is always cleared. */ }
    onChange(null); setKey(''); setError(''); setEditing(true);
  }
  return <section className="discovery-provider" aria-label="Business search provider">
    <label htmlFor="search-provider-choice">Search provider</label>
    <select id="search-provider-choice" value={providerId} disabled={busy} onChange={event => { disconnect(); setProviderId(event.target.value); }}>
      <option value="tomtom">TomTom — free account to get started</option>
      <option value="geofabrik">Geofabrik — paid Overpass account</option>
    </select>
    <strong>{connection ? `${provider.name} search` : providerId === 'tomtom' ? 'Search with your own TomTom key' : 'Paid provider account and API key required'}</strong>
    {!connection && (providerId === 'tomtom' ? <>
      <p>Business search is optional. Create a TomTom account, enable Places Search API, then create an API key and paste it below. No SDK or ChatGPT key is needed.</p>
      <small>The current free allowance is 5,000 Discover requests per month; check pricing for updates. Paid usage is optional. Each installation needs its own key or access provided by your company.</small>
    </> : <p>Business search uses a paid Geofabrik subscription. Each independent installation needs access to a provider account and key.</p>)}
    {providerId === 'tomtom' && <details className="provider-key-help"><summary>How to get a TomTom key</summary><TomTomKeySteps/></details>}
    {providerId === 'tomtom' && <small>Search results are temporary previews. Downloading or saving TomTom results is not included.</small>}
    {connection && <p role="status">{verified ? 'Last search succeeded.' : 'API key set. Run a search to verify access.'}</p>}
    {editing ? <form onSubmit={apply}>
      <label htmlFor="search-provider-key">{provider.name} API key</label>
      <input id="search-provider-key" type="password" autoComplete="off" spellCheck="false" value={key} onChange={event => setKey(event.target.value)} disabled={busy} placeholder="Paste your provider API key" />
      <button className="discovery-provider-save" disabled={!key.trim() || busy}>Use this key</button>
      {connection && <button type="button" disabled={busy} onClick={() => { setEditing(false); setKey(''); setError(''); }}>Cancel</button>}
    </form> : <div className="discovery-provider-actions"><button type="button" disabled={busy} onClick={() => setEditing(true)}>Change key</button><button type="button" disabled={busy} onClick={disconnect}>Disconnect</button></div>}
    {error && <p className="discovery-error" role="alert">{error}</p>}
    <small>Your key is stored for this browser tab's session and is excluded from territory backups. Use Disconnect to remove it.</small>
    <a href={provider.accountUrl} target="_blank" rel="noreferrer">{providerId === 'tomtom' ? 'Create account / get API key ↗' : 'Provider signup and pricing ↗'}</a>
    {provider.pricingUrl && <a href={provider.pricingUrl} target="_blank" rel="noreferrer">TomTom pricing ↗</a>}
    
  </section>;
}
