import { readSheet as readXlsxSheet } from 'read-excel-file/browser';

function normalizeHeader(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizePlaceName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/(?:\s+(?:city and borough|city \(balance\)|metropolitan government \(balance\)|metro government \(balance\)|consolidated government \(balance\)|unified government \(balance\)|municipality|borough|village|town|city|cdp))+$/i, '')
    .replace(/[^a-z0-9]/g, '');
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  row.push(field);
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
}

export async function readImportTable(file) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'csv') return parseCsv(await file.text());
  if (extension === 'xlsx') return readXlsxSheet(file);
  throw new Error('Choose a .csv or .xlsx file, or a JSON backup.');
}

let cityIndexPromise;

async function loadCityIndex() {
  if (!cityIndexPromise) {
    cityIndexPromise = fetch(`${import.meta.env.BASE_URL}us-places.txt`)
      .then((response) => {
        if (!response.ok) throw new Error('The local U.S. city index could not be loaded.');
        return response.text();
      })
      .then(buildCityIndex);
  }
  return cityIndexPromise;
}

export function buildCityIndex(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split('|');
  const nameIndex = headers.indexOf('NAME');
  const latitudeIndex = headers.indexOf('INTPTLAT');
  const longitudeIndex = headers.indexOf('INTPTLONG');
  const index = new Map();

  lines.forEach((line) => {
    const columns = line.split('|');
    const state = columns[0]?.trim().toUpperCase();
    const cityKey = normalizePlaceName(columns[nameIndex]);
    const latitude = Number(columns[latitudeIndex]);
    const longitude = Number(columns[longitudeIndex]);
    if (state && cityKey && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      const key = `${state}|${cityKey}`;
      if (!index.has(key)) index.set(key, { lat: latitude, lng: longitude });
    }
  });

  return index;
}

function normalizeRelationship(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'customer') return 'Customer';
  if (normalized === 'prospect') return 'Prospect';
  return null;
}

export async function prepareImportRows(table, existingLocations, fileName, cityIndexOverride) {
  if (table.length < 2) throw new Error('The file must include a header row and at least one data row.');
  const headerIndexes = new Map(table[0].map((header, index) => [normalizeHeader(header), index]));
  const requiredHeaders = ['account', 'relationshipstatus', 'city', 'st'];
  const missingHeaders = requiredHeaders.filter((header) => !headerIndexes.has(header));
  if (missingHeaders.length) throw new Error('Required columns: Account, Relationship Status, City, ST.');

  const cityIndex = cityIndexOverride || await loadCityIndex();
  const seenKeys = new Set(existingLocations.map((location) => `${String(location.company).trim().toLowerCase()}|${normalizePlaceName(location.city)}|${String(location.state).trim().toUpperCase()}`));
  const prepared = [];

  table.slice(1).forEach((row, rowIndex) => {
    const account = String(row[headerIndexes.get('account')] ?? '').trim();
    const statusRaw = row[headerIndexes.get('relationshipstatus')];
    const status = normalizeRelationship(statusRaw);
    const city = String(row[headerIndexes.get('city')] ?? '').trim();
    const state = String(row[headerIndexes.get('st')] ?? '').trim().toUpperCase();
    const base = { rowNumber: rowIndex + 2, account, status: status || String(statusRaw ?? '').trim(), city, state };

    if (!account || !city || !state) {
      prepared.push({ ...base, outcome: 'invalid', message: 'Missing Account, City, or ST' });
      return;
    }
    if (!status) {
      prepared.push({ ...base, outcome: 'invalid', message: 'Status must be Customer or Prospect' });
      return;
    }
    if (!/^[A-Z]{2}$/.test(state)) {
      prepared.push({ ...base, outcome: 'invalid', message: 'ST must be a 2-letter abbreviation' });
      return;
    }

    const cityCoordinates = cityIndex.get(`${state}|${normalizePlaceName(city)}`);
    if (!cityCoordinates) {
      prepared.push({ ...base, outcome: 'invalid', message: 'City/ST not found' });
      return;
    }

    const duplicateKey = `${account.toLowerCase()}|${normalizePlaceName(city)}|${state}`;
    if (seenKeys.has(duplicateKey)) {
      prepared.push({ ...base, outcome: 'duplicate', message: 'Already on the map' });
      return;
    }
    seenKeys.add(duplicateKey);

    prepared.push({
      ...base,
      outcome: 'ready',
      message: 'Ready',
      location: {
        id: `import-${Date.now()}-${rowIndex}`,
        company: account,
        status,
        locationType: 'Imported Location',
        address: `${city}, ${state}`,
        city,
        state,
        ...cityCoordinates,
        source: `${fileName} import`,
        verificationStatus: 'Needs review',
      },
    });
  });

  if (!prepared.length) throw new Error('No data rows were found.');
  return prepared;
}

