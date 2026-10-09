# Third-party notices

The project's MIT license covers Territory Atlas source, not third-party
libraries, fonts, hosted services, or data. Preserve their applicable notices
when redistributing source or built assets. Installed dependency license
texts and declared-license information are collected in [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt);
regenerate with `npm run licenses` after dependency changes.

`worker-f` declares MIT in its package metadata but ships no standalone license
or copyright notice; the collection identifies that omission and includes its
published author attribution and standard MIT terms. Rolldown's platform binding
uses the matching parent package's license and third-party notices. MurmurHash's
license is included from its README.

| Component | License | Project |
| --- | --- | --- |
| React and React DOM | MIT | https://github.com/facebook/react |
| MapLibre GL JS | BSD-3-Clause | https://github.com/maplibre/maplibre-gl-js |
| Leaflet | BSD-2-Clause | https://github.com/Leaflet/Leaflet |
| Lucide React icons | ISC | https://github.com/lucide-icons/lucide |
| read-excel-file | MIT | https://github.com/catamphetamine/read-excel-file |
| Vite and React plugin (build tools) | MIT | https://github.com/vitejs/vite |

## Maps and address lookup

Map data: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
available under the Open Database License (ODbL). MapLibre displays the
attribution provided by the OpenFreeMap style; the 2D map shows OpenStreetMap
attribution. Keep attribution visible in deployments and screenshots.

The 3D view uses [OpenFreeMap](https://openfreemap.org/quick_start/), which serves
OpenStreetMap-derived vector tiles and styles. The 2D view uses OSM's standard
tile service; its [tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
applies separately from the data license. Do not bulk download or prefetch tiles.

Address search uses [Nominatim](https://operations.osmfoundation.org/policies/nominatim/)
only when a user saves a new or changed address. The public service permits
at most one request per second across an application, requires attribution
and an identifying Referer or User-Agent, and forbids sending confidential
information. Territory Atlas caches repeat queries during a session and spaces
requests within that tab. This is intended for modest local use; it does not
coordinate traffic across users or tabs. For a multiuser deployment, configure
a suitable provider or a self-hosted Nominatim endpoint and enforce aggregate
limits. Edit `public/geocoding-config.json` before building, or
`dist/geocoding-config.json` after building; a page reload picks up the endpoint
without a new application build. The endpoint must support Nominatim's search
parameters and response format. Do not put provider secrets in this public file.

## Business discovery

The default trial provider is [TomTom Places Search API](https://docs.tomtom.com/places-search-api/documentation/places-search/discover).
An account and API key are required. API access, returned data, and billing
remain subject to TomTom's applicable agreement; the MIT license covers this
application's source, not TomTom data. The interface identifies TomTom results
and displays © TomTom attribution.

**TomTom discoveries are preview only.** They cannot be added to the territory,
exported, backed up, or cached between searches. The current
[TomTom Portal Terms and Conditions](https://docs.tomtom.com/legal/terms-and-conditions)
(checked October 8, 2026), clause 11.4, restrict result storage to client
caching governed by response cache-control headers; clause 11.6.1 also
restricts derived databases. Persistent prospect storage needs an applicable
agreement permitting that use. Such permission has not been established, and
permission to display results on the current non-TomTom basemaps has not yet
been confirmed. The integration is an evaluation candidate, not a claim of
production readiness or complete factory coverage. Confirm these permissions
before enabling permanent prospect storage or publicly deploying this provider.
See [the draft data-use request](docs/tomtom-data-use-request.md) for the
intended **Add as prospect** workflow and specific permissions to resolve.

TomTom receives an exact circle or closed polygon and fixed POI filters/keywords.
The key is transmitted only to `api.tomtom.com` in the TomTom-Api-Key header.
The API limits each request to 100 results. No customer records are transmitted.

[Geofabrik's managed Overpass service](https://www.geofabrik.de/data/overpass-api.html)
remains an alternative for paid account holders. It queries named OSM features
in the enclosing rectangle; the app checks centers against the exact outline.
Results retain source URLs, © OpenStreetMap contributors attribution, and
ODbL-1.0 metadata. Redistributing saved OSM discoveries remains subject to
[ODbL and attribution requirements](https://www.openstreetmap.org/copyright).
Geofabrik requires its key in the URL; keep network logs private. Queries are
limited to 200 features and cached in memory for five minutes. Removing or
changing a connection clears that cache. Public Overpass fallback is not used.

Both integrations require user-supplied credentials stored in sessionStorage,
separately from territory data and backups. A public hosted application should
protect shared credentials and limit aggregate usage. Keys supplied in a browser
remain visible in network tools; apply provider restrictions and request caps.
Searches are user initiated, bounded to about 31 miles (50 km), cancellable,
and use timeouts. Retry-After is honored for rate limits and provider pauses;
access errors do not impose an arbitrary cooldown. No background polling or
automatic retry is performed. Verify facilities and entrances before visits.

## City index

`public/us-places.txt` comes from the U.S. Census Bureau's
[2025 Gazetteer Places file](https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.2025.html).
It provides representative city coordinates, not street-level geocoding.
Census Bureau employee-created data generally are not subject to U.S. copyright;
see the Bureau's [research and public-access policy](https://www2.census.gov/foia/ds_policies/ds027.pdf).
Credit the Census Bureau as the source; no endorsement is implied.

## Fonts

The interface requests Inter and IBM Plex Mono from Google Fonts. Their SIL
Open Font License 1.1 texts and copyright notices are available from the
[Inter](https://github.com/google/fonts/blob/main/ofl/inter/OFL.txt) and
[IBM Plex Mono](https://github.com/google/fonts/blob/main/ofl/ibmplexmono/OFL.txt)
font directories. If you bundle or self-host fonts, include those notices.

## Demo data

Demo business names and relationships are fictional. Coordinates represent
city centers rather than actual facilities. No private account data or
database connection is part of the demo.
