/**
 * Downloads vesiliikennemerkit.gpkg, parses it with sql.js, then reports:
 *  - All unique (vlmlajityyppi, suffix_value) combinations found in the data
 *  - Which derived iconKeys already have a PNG in public/images/
 *  - Which are MISSING
 */
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Download the GPKG -------------------------------------------------------
const GPKG_URL =
  'https://roglind.github.io/finland-boater-map/data/vesiliikennemerkit.gpkg';

console.log('Fetching', GPKG_URL, '…');
let gpkgBuffer;
try {
  const res = await fetch(GPKG_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  gpkgBuffer = Buffer.from(await res.arrayBuffer());
  console.log(`Downloaded ${gpkgBuffer.length} bytes.`);
} catch (e) {
  console.error('Download failed:', e.message);
  process.exit(1);
}

// ---- Load sql.js (Node-compatible build) ------------------------------------
// sql.js ships a node-compatible build we can require directly
const require = createRequire(import.meta.url);
const initSqlJs = require('../node_modules/sql.js/dist/sql-wasm.js');
const SQL = await initSqlJs();

const db = new SQL.Database(new Uint8Array(gpkgBuffer));

// ---- Discover column names --------------------------------------------------
const pragma = db.exec("PRAGMA table_info(vesiliikennemerkit)");
const cols = (pragma[0]?.values ?? []).map(r => r[1]);
console.log('\nColumns in vesiliikennemerkit:', cols.join(', '));

// ---- Query all rows ---------------------------------------------------------
const SUURUUS_SUFFIX_TYPES = new Set([11, 15, 16, 17, 19]);

const rows = db.exec('SELECT * FROM vesiliikennemerkit')[0];
if (!rows) { console.log('No rows found.'); process.exit(0); }

const colIdx = Object.fromEntries(rows.columns.map((c, i) => [c.toLowerCase(), i]));

const get = (row, ...names) => {
  for (const n of names) {
    const v = row[colIdx[n] ?? colIdx[n.replace(/_/g, '')]];
    if (v != null) return v;
  }
  return null;
};

const parseNum = (raw) => {
  if (typeof raw === 'number' && isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === 'string') { const m = raw.match(/(\d+)/); if (m) return parseInt(m[1], 10); }
  return undefined;
};

const iconKeyCounts = new Map();

for (const row of rows.values) {
  const vlmlajityyppi = get(row, 'vlmlajityyppi') ?? 0;
  const rajoitusarvo  = parseNum(get(row, 'rajoitusarvo'));
  const suuruus       = parseNum(get(row, 'suuruus'));

  const suffixSource  = SUURUUS_SUFFIX_TYPES.has(vlmlajityyppi)
    ? (suuruus ?? rajoitusarvo)
    : rajoitusarvo;

  const iconKey = suffixSource != null
    ? `merkki${vlmlajityyppi}_${suffixSource}`
    : `merkki${vlmlajityyppi}`;

  iconKeyCounts.set(iconKey, (iconKeyCounts.get(iconKey) ?? 0) + 1);
}

db.close();

// ---- Compare with public/images/ --------------------------------------------
const imagesDir = path.join(__dirname, '..', 'public', 'images');
const existingFiles = new Set(
  readdirSync(imagesDir).filter(f => f.endsWith('.png'))
);

console.log('\n=== ALL ICON KEYS FOUND IN DATA ===');
const sorted = [...iconKeyCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
const missing = [];
for (const [key, count] of sorted) {
  const file = `${key}.png`;
  const exists = existingFiles.has(file);
  console.log(`  ${exists ? '✓' : '✗ MISSING'} ${key}  (${count} signs)`);
  if (!exists) missing.push({ key, count });
}

console.log('\n=== EXISTING PNGs in public/images/ ===');
for (const f of [...existingFiles].sort()) console.log(' ', f);

console.log(`\n=== SUMMARY ===`);
console.log(`Total unique icon keys:  ${iconKeyCounts.size}`);
console.log(`Keys with PNG present:   ${iconKeyCounts.size - missing.length}`);
console.log(`Keys MISSING a PNG:      ${missing.length}`);
if (missing.length) {
  console.log('\nMissing files needed:');
  for (const { key, count } of missing) {
    console.log(`  public/images/${key}.png   (used by ${count} sign${count > 1 ? 's' : ''})`);
  }
}
