# Territory Atlas

**A free, open-source territory map for freight and industrial sales reps. Import your accounts, explore nearby facilities, and plan customer visits.**

Source and contributions: [buloxdev/territory-atlas](https://github.com/buloxdev/territory-atlas).

Import a customer spreadsheet and use your own TomTom API key to search for
businesses in an area you draw. Runs locally in your browser without a
Territory Atlas account or an application backend. Your saved account records
stay in your browser; optional business discovery uses your own provider key.

**Import once. Your accounts stay saved in this browser when you refresh or
return to the same site. You do not need to import them again for each search.**
Accounts do not automatically sync between browsers or devices. Clearing the
site's browser storage removes saved accounts; use **Backup** to keep a copy
and restore it when needed. The TomTom key is separate and lasts for the tab's
session, so you may need to enter it again in a new session.

Use the map to explore locations before a visit. Visit scheduling, driving
routes, and visit shortlists are planned features.

## How it works

1. Select **Import / manage locations**, then **Import** to upload your customer
   spreadsheet (`.csv` or `.xlsx`). Review the preview and confirm the import.
2. Open **Find nearby businesses** and enter your own TomTom Places Search API key.
3. Draw a circle or freehand area near your customers, then search for businesses
   such as manufacturers, warehouses, or distributors.
4. Review the matches on the map and check their facility details before outreach.

The software is free. TomTom access is subject to its current allowances,
pricing, and terms. TomTom matches are currently preview only; saving and
exporting them are disabled. See the discovery section below for details.

## Start locally

Use **Node.js 24 LTS** (minimum 22.12) and npm. If you use nvm, run `nvm use`.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. The default view is the MapLibre 3D map.
Select **Import / manage locations** to import, edit, delete, and back up locations in
the Leaflet 2D view. Select **3D map** to return to the territory overview.
The 3D view needs WebGL; `?view=2d` works without it.

```bash
npm test
npm run build
npm run preview
```

The production files are written to `dist/`. On macOS, after building,
double-click `START_MAP.command` to serve `dist/` locally. This optional
launcher needs Python 3; keep the terminal open and press Ctrl+C to stop it.
The existing private desktop `.app` bundle is excluded from the public source.

## Try the demo

A fresh browser opens a welcome screen. Choose **Try the demo** to explore ten
fictional customer and prospect facilities across the Midwest. The demo uses a
separate workspace, so demo edits do not enter your actual territory. Choose
**Get started → Open my territory** to return to your accounts. Several companies have multiple locations. Demo coordinates
are **city centers**, not actual facility addresses, and are marked as needing
review. Search a company name to see its locations, or filter by relationship.

Existing locations saved by Freight Network Map are retained in the same
browser and origin. Choose **Get started → Try the demo** to explore without changing your accounts. No private prospect list or Notion
database link is included in the source.

## Import a spreadsheet

In **Manage locations**, select **Import** and choose a `.csv` or `.xlsx` file.
The first row needs these four columns, in any order:

```text
Account, Relationship Status, City, ST
```

Use `Customer` or `Prospect` and a two-letter U.S. state abbreviation.
Choose **Import** for the downloadable Excel-compatible CSV template, an example,
and a row-by-row review. Replace the template’s example rows with your accounts.
Try [examples/accounts.csv](examples/accounts.csv). Imported rows are placed
at city centers using the bundled 2025 U.S. Census Gazetteer Places index;
spreadsheet imports do not send accounts to a geocoding service.

Review the preview before confirming. Duplicate and invalid rows are skipped.
A duplicate is the same account, normalized city, and state already on the map
or earlier in the file. Different cities can represent the same company's
facilities. Multiple facilities for the same account in one city are not yet
supported by spreadsheet import; add those locations manually.

Imported locations start as **Needs review**. Edit a location to enter its
facility address, choose its type, and mark it verified after confirming it.
The **Needs verification** filter shows unverified customer locations.

## Find businesses in a drawn area

**TomTom is the default search provider. A TomTom account and API key are required.**
The map, imports, drawing tools, saved accounts, and backups work without a
provider account. No ChatGPT key is needed. This integration is a trial:
actual manufacturer coverage must be evaluated with a valid key.

1. Create an account at [TomTom](https://my.tomtom.com/), enable **Places Search API**,
   and create an API key for that product. The current
   [pricing page](https://docs.tomtom.com/pricing) lists 5,000 free Discover
   requests per month with no credit card needed; allowances can change.
2. Refresh the app, open **Find nearby businesses** in either map view, select
   **TomTom**, enter the key, and choose **Use this key**. Only a successful
   search verifies access. A rejected key can be corrected immediately.
3. Restrict the key to the app's browser domain and required API product, set
   request limits, and monitor its use in your TomTom account. Browser keys
   are visible in network tools. Do not bundle a company key in public source.
4. The key is stored in sessionStorage, separately from territory data.
   **Disconnect** removes it. Keys are excluded from territory backups and
   source releases. A company can supply access; a protected shared-account
   backend is not included in this local browser app.

Choose **Circle**, then **Draw a circle** and drag from its center to its edge,
or tap the center then the edge on touch. Choose **Freehand** to trace an outline;
releasing closes it. Drag the area or center handle to move it. Edge/corner
handles resize it; focused handles support arrow keys and Shift for larger steps.
Circle radii are entered in miles (0.1–31.1). Esc cancels a gesture. Changing the
area, category, or provider clears old results and cancels outstanding searches.

TomTom's Places Search v3 Discover endpoint receives the selected circle or
closed polygon, explicit POI filters, and the key in an API header. It does not
receive saved territory records. Manufacturers use `manufacturing_facility` and
`industrial_facility`; distributors use `import_or_export_and_distribution`.
Warehouses use a keyword search because there is no general warehouse filter.
Food, metal, and packaging use keywords within manufacturing/industrial types.
With TomTom, the category buttons are optional shortcuts. Type another business
name or type, such as "plastic manufacturers" or "CNC machine shops", to run a
text search inside the drawn boundary. Custom searches preserve the entered
business terms and do not apply an unrelated shortcut's POI type filter. Phrases
ending in "manufacturers", "factories", or "plants" search the preceding term
within manufacturing/industrial types ("plastic manufacturers" searches for
"plastic"), which reduces unrelated keyword matches such as plastic surgeons.
Employee count and revenue are not supported filters. Geofabrik continues to
use the listed categories because its queries depend on predefined OSM tags.
Keyword searches may miss businesses or return imperfect matches; verify results.

Results appear as temporary orange pins, with available addresses and websites.
Distances are straight-line miles from the area center. The app checks each
provider point against the exact selected area and marks existing accounts.
TomTom returns at most 100 results per request; the interface flags that limit.
**TomTom results are preview only. Saving and downloading those search results
are outside this release’s scope.** Trial results are not cached between queries
or stored in localStorage, and are excluded from backups. Existing imported
territory data remains editable and exportable.

**Geofabrik** remains available in the provider selector for existing paid
Overpass accounts. It searches named OpenStreetMap features within the enclosing
rectangle, then checks feature centers against the exact outline. Geofabrik
results retain OSM attribution and ODbL metadata and can be added as prospects
with **Needs review** status. Queries have a 200-feature limit and a five-minute
in-memory cache. There is no fallback to public Overpass servers.

Both providers use explicit user-initiated requests, timeouts and cancellation.
Access errors, empty searches, incomplete responses, and rate limits are shown
separately. Provider-requested pauses honor Retry-After; no automatic retries
or background polling occur. Neither provider is a complete prospect directory,
and a match does not establish shipping volume or buying intent.

## Backups and your data

Imported accounts and edits stay saved when you refresh or return to the same
site in the same browser; searches do not require another import.
The toolbar shows **Saved in this browser**, with **Backup** and **Restore**
available in both views. If storage fails, a warning explains that changes are
only in memory and asks you to download a backup.

Edits are saved in localStorage in the current browser and origin. Clearing
browser data, switching browsers, or changing the host/port changes the stored
territory. Use **Backup** regularly to download a portable JSON file. Importing
a JSON backup **replaces** the current territory; importing a spreadsheet adds
locations after review. An empty JSON array clears the territory.

There is no application analytics, cloud account sync, or customer-data upload
endpoint. External requests still happen:

- 3D map styles and tiles come from OpenFreeMap; 2D tiles come from OpenStreetMap.
- Automatic address lookup, when configured, sends the address to that provider.
  The local build uses Nominatim. The public upload package disables automatic
  lookup by default; enter facility coordinates directly or import city locations.
- TomTom discovery sends the selected boundary and category or entered search terms,
  with the key in an API header. Geofabrik discovery sends the enclosing rectangle
  and fixed OSM filters, with its key in the URL. Neither sends saved account
  records. Avoid sharing network logs containing either key.
- The interface loads fonts from Google Fonts.

Map providers receive ordinary request metadata and the map areas being viewed.
For a public deployment with substantial traffic, configure providers that
support your expected usage. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Roadmap

- Group facilities by company with company-level summaries.
- Select a customer and a distance to find the five nearest prospects worth
  considering for a visit.
- Add visit dates and export a shortlist. Nearby means geographic proximity;
  driving routes and travel times will need a routing provider.

These are planned features, not part of the first release.

## Contributing and licensing

See [CONTRIBUTING.md](CONTRIBUTING.md). Territory Atlas source is licensed under
[MIT](LICENSE). Dependencies, fonts, and map data retain their own licenses;
see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and
[THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).

## Publish to Cloudflare

Use Cloudflare Pages Direct Upload through Wrangler. A GitHub connection,
database, and visitor login are not required. Use Node.js 24 LTS.

Connect your Cloudflare account once on each development machine:

```bash
npm ci
npm run cloudflare:login
npm run cloudflare:status
```

For every website update, run:

```bash
npm run deploy
```

This runs the tests, builds the public release, and uploads
`output/cloudflare-site/` directly to the existing **territory-atlas** Pages
project. No ZIP download or dashboard upload is needed. **This command publishes
the website.** Editing code or pushing it to GitHub does not publish automatically.

If you fork this repo, first create your own Pages Direct Upload project.
Change `--project-name territory-atlas` in `package.json` to your project name
and `--branch main` to its production branch. Cloudflare supplies a public
HTTPS `pages.dev` address. Your Cloudflare credentials stay outside the source
repo; do not commit credentials or provider keys.

To prepare files without publishing, use `npm run release`. It prepares:

- `output/territory-atlas-cloudflare.zip`: upload-ready website, with `index.html` at the root.
- `output/cloudflare-site/`: the same website as a folder.
- `output/territory-atlas-source.zip`: MIT-licensed source code, also downloadable from the public website’s **Privacy & data** panel.

The ZIP remains available for optional manual uploads. See
[Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
for Wrangler and dashboard instructions.

The public package has automatic address lookup disabled to avoid relying on a public geocoding endpoint for aggregate website traffic. Spreadsheet imports use the bundled city index. Facility coordinates can be entered directly. An operator can set `geocoding-config.json` to an appropriate Nominatim-compatible endpoint with browser access enabled. Provider terms and usage requirements still apply. No provider API key is shipped with the website or source.

Visitors connect their own TomTom account only if they want business search. The website is free; external providers have their own pricing and terms. Source licensing does not license third-party services or data. TomTom search results are temporary previews and are not saved or downloaded by this release.

Before changing from the local URL to the public URL, download your territory backup locally and restore it on the public site. Browser storage does not transfer between addresses. Test import, backup/restore, both map views, and optional search on the final HTTPS site after upload.
