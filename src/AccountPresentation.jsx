import React from 'react';
import { SheetHead } from './Blueprint.jsx';
import { hasMapCoordinates } from './coordinates.js';

export function isLocationVerified(location) {
  return location.verificationStatus
    ? location.verificationStatus === 'Verified'
    : Boolean(location.verifiedUrl);
}

const degrees = (value, positive, negative) =>
  `${Math.abs(Number(value)).toFixed(4)}° ${Number(value) >= 0 ? positive : negative}`;

export function AccountRow({ location, index, selected, onSelect, disabled = false }) {
  return <button className={`atlas-location ${selected ? 'chosen' : ''}`}
    onClick={onSelect} disabled={disabled} aria-pressed={selected}>
    <span className="atlas-index">{String(index + 1).padStart(2, '0')}</span>
    <span><strong>{location.company}</strong><small>{location.city}, {location.state}</small>
      <em>{location.status} · {location.locationType}{!hasMapCoordinates(location) && ' · Unplaced'}</em></span>
    <span className="atlas-rel" aria-hidden="true">{location.status === 'Customer' ? 'CUST' : 'PROS'}</span>
  </button>;
}

export function AccountDetails({ location, onClose, actions, note, children }) {
  const verified = isLocationVerified(location);
  return <aside className="atlas-details" aria-label="Selected account">
    <SheetHead number="DETAIL B" title="Location" as="p">
      <button className="atlas-close" aria-label="Close location details" onClick={onClose}>×</button>
    </SheetHead>
    <div className="atlas-details-body">
      <h2>{location.company}</h2>
      <p>{location.address || `${location.city}, ${location.state}`}</p>
      <div className="atlas-chips"><span className={location.status === 'Customer' ? 'is-customer' : ''}>{location.status}</span><span>{location.locationType}</span></div>
      <dl className="atlas-spec">
        <div><dt>Coordinates</dt><dd>{hasMapCoordinates(location)
          ? `${degrees(location.lat, 'N', 'S')} · ${degrees(location.lng, 'E', 'W')}`
          : 'Unplaced — add coordinates'}</dd></div>
        <div><dt>Verification</dt><dd className={verified ? '' : 'needs-review'}>{verified ? 'Verified' : 'Needs review'}</dd></div>
        {location.source && <div><dt>Source</dt><dd>{location.source}</dd></div>}
      </dl>
      <div className="atlas-detail-actions">{actions.map(action => <button key={action.label} onClick={action.onClick} disabled={action.disabled}>{action.label}</button>)}</div>
      {children}
      {note && <small>{note}</small>}
    </div>
  </aside>;
}
