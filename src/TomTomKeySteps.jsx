import React from 'react';

export default function TomTomKeySteps() {
  return <div className="tomtom-key-steps">
    <ol>
      <li><strong>Create your TomTom account.</strong> Go to <a href="https://my.tomtom.com/" target="_blank" rel="noreferrer">MyTomTom ↗</a> and sign up or sign in.</li>
      <li><strong>Choose a key for Places Search API.</strong> Open <b>API & SDK Keys</b>. Use your first key, or create a new API key named “Territory Atlas.” Check that <b>Places Search API</b> is included in its products; edit the key to add it if needed.</li>
      <li><strong>Copy the full key.</strong> Click the key in the keys list to copy it. The shortened text with dots is only a preview.</li>
      <li><strong>Connect it here.</strong> Open the map → <b>Find nearby businesses</b> → choose <b>TomTom</b>. Paste the key into <b>TomTom API key</b> and select <b>Use this key</b>. Draw an area, enter a business type, and search.</li>
    </ol>
    <p className="launch-muted">You only need an API key—no SDK or ChatGPT subscription. Your key stays in this tab’s session and is excluded from territory backups.</p>
    <p className="launch-muted">TomTom provides included usage and has its own limits and terms. Check <a href="https://docs.tomtom.com/pricing" target="_blank" rel="noreferrer">current pricing ↗</a> before enabling paid usage.</p>
    <a href="https://docs.tomtom.com/platform/documentation/my-tomtom/how-to-get-a-tomtom-api-key" target="_blank" rel="noreferrer">TomTom’s official key guide ↗</a>
  </div>;
}
