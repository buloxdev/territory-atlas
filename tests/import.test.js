import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parseCsv, prepareImportRows, buildCityIndex } from '../src/import.js';

const cities = new Map([
  ['IL|chicago', { lat: 41.88, lng: -87.63 }],
  ['WI|milwaukee', { lat: 43.04, lng: -87.91 }],
]);

test('CSV preserves quoted commas, escaped quotes, CRLF, and a BOM', () => {
  assert.deepEqual(parseCsv('\uFEFFAccount,City\r\n"Supply, Inc.",Chicago\r\n"The ""Example"" Co.",Milwaukee\r\n'), [
    ['Account', 'City'], ['Supply, Inc.', 'Chicago'], ['The "Example" Co.', 'Milwaukee'],
  ]);
});

test('imports a second city for a company while skipping normalized duplicates and invalid rows', async () => {
  const existing = [{ company: 'Example Supply', city: 'Chicago', state: 'IL' }];
  const table = [
    ['ST', 'City', 'Relationship Status', 'Account'],
    ['il', 'Chicago city', 'customer', 'EXAMPLE SUPPLY'],
    ['WI', 'Milwaukee', 'Prospect', 'Example Supply'],
    ['WI', 'milwaukee city', 'Prospect', 'Example Supply'],
    ['IL', 'Missing city', 'Customer', 'Other'],
    ['IL', 'Chicago', 'Partner', 'Other'],
    ['Illinois', 'Chicago', 'Customer', 'Other'],
  ];
  const rows = await prepareImportRows(table, existing, 'accounts.csv', cities);
  assert.deepEqual(rows.map((row) => row.outcome), ['duplicate', 'ready', 'duplicate', 'invalid', 'invalid', 'invalid']);
  assert.equal(rows[1].location.city, 'Milwaukee');
  assert.equal(rows[1].location.lat, 43.04);
  assert.equal(rows[1].location.verificationStatus, 'Needs review');
  assert.equal(rows[1].location.source, 'accounts.csv import');
});

test('missing required columns fail before adding any locations', async () => {
  await assert.rejects(prepareImportRows([['Account', 'City'], ['Example', 'Chicago']], [], 'bad.csv', cities), /Required columns/);
});

test('the example spreadsheet resolves every city against the bundled Census Gazetteer', async () => {
  const gazetteer = await readFile(new URL('../public/us-places.txt', import.meta.url), 'utf8');
  const example = await readFile(new URL('../examples/accounts.csv', import.meta.url), 'utf8');
  const rows = await prepareImportRows(parseCsv(example), [], 'accounts.csv', buildCityIndex(gazetteer));
  assert.deepEqual(rows.map((row) => row.outcome), ['ready', 'ready', 'ready', 'ready', 'ready']);
  assert.equal(rows[4].location.city, 'Indianapolis');
});
