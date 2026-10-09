# TomTom prospect-saving permission request

Draft only — not sent.

## Intended product behavior

Search for nearby businesses, select a result, and choose **Add as prospect**.
Save the facility in the user's browser alongside imported accounts, marked
**Needs review**, with source attribution. Users can edit or delete saved
prospects and include them in a portable territory backup.

## Request to TomTom

Subject: Permission to retain selected Places Search results in Territory Atlas

We are building Territory Atlas, a free, MIT-licensed browser application for
freight and industrial sales reps. Users import their own account lists and
connect their own TomTom Places Search API key to discover businesses inside
a circle or freehand area. Saved account lists are not sent to TomTom.

We want users to explicitly select individual search results and save them as
prospects alongside their existing accounts. We do not intend to bulk collect
results or publish a shared prospect directory.

Could you confirm what agreement and account entitlement would permit:

- Persistent storage of selected POI names, addresses, coordinates, facility
  types, websites, and identifiers in the user's browser.
- Display of those results on OpenFreeMap/OpenStreetMap basemaps using MapLibre
  or Leaflet.
- User edits, deletion, and personal JSON backups containing saved prospects,
  including restoration on another device.
- Use of this flow in a publicly hosted, open-source application where each
  user supplies their own key.

Please specify any retention limits, refresh/deletion requirements,
attribution requirements, end-user terms, and pricing. Does permission need to
be granted to each key holder, the application publisher, or both?

## Current restriction

Checked on October 8, 2026: the [TomTom Portal Terms and Conditions](https://docs.tomtom.com/legal/terms-and-conditions),
clause 11.4, restrict result storage to limited client caching governed by
response cache-control headers. Clause 11.6.1 also restricts creating derived
databases from supplied content. The terms recognize separate written
agreements. Standard API access alone does not establish permission for the
persistent prospect-saving workflow above.

Until an applicable agreement permits it, the implementation continues to
prevent saving and exporting TomTom search results. Imported accounts and
manually entered locations remain editable and exportable.
