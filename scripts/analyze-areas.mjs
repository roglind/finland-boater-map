/**
 * Downloads rajoitusalue_a.gpkg, parses it with sql.js, applies the same
 * RAJOITUSTYYPIT_TO_VLMLAJITYYPPI translation table used in restrictionDisplay.ts,
 * then reports which derived iconKeys are missing from public/images/.
 */
import { readdirSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Mirrors restrictionDisplay.ts exactly ----------------------------------
const SUURUUS_SUFFIX_TYPES = new Set([3, 11, 12, 15, 16, 17, 19]);

const RAJOITUSTYYPIT_TO_VLMLAJITYYPPI = {
  1: 11,
  2: 6,
  3: 8,
  4: 10,
  5: 9,
  6: 1,
  7: 2,
  8: 3,
  9: 4,
  10: 5,
  11: 0
};

function parseRajoitustyypitToVlmlajityyppi(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const parts = raw.split(/[,\s;]+/).map(p => p.trim()).filter(Boolean);
  const result = [];
  const seen = new Set();
  for (const p of parts) {
    const n = parseInt(p, 10);
    if (!Number.isFinite(n) || n < 1 || n > 11) continue;
    const vlm = RAJOITUSTYYPIT_TO_VLMLAJITYYPPI[n];
    if (vlm !== undefined && vlm !== 0 && !seen.has(vlm)) {
      seen.add(vlm);
      result.push(vlm);
    }
  }
  return result;
}

function deriveIconKey(vlmlajityyppi, suuruusKmh) {
  if (SUURUUS_SUFFIX_TYPES.has(vlmlajityyppi) && suuruusKmh != null) {
    return `merkki${vlmlajityyppi}_${suuruusKmh}`;
  }
  return `merkki${vlmlajityyppi}`;
}

function parseSuuruus(raw) {
  if (typeof raw === 'number' && isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === 'string') {
    const m = raw.match(/(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  return undefined;
}

// ---- Download GPKG ----------------------------------------------------------
const GPKG_URL =
  'https://roglind.github.io/finland-boater-map/data/rajoitusalue_a.gpkg';

console.log('Fetching', GPKG_URL, '…');
const res = await fetch(GPKG_URL);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const gpkgBuffer = Buffer.from(await res.arrayBuffer());
console.log(`Downloaded ${gpkgBuffer.length} bytes.`);

// ---- Open with sql.js -------------------------------------------------------
const require = createRequire(import.meta.url);
const initSqlJs = require('../node_modules/sql.js/dist/sql-wasm.js');
const SQL = await initSqlJs();
const db = new SQL.Database(new Uint8Array(gpkgBuffer));

// Discover Finnish-character column names (ä encoding variants)
const pragma = db.exec("PRAGMA table_info(rajoitusalue_a)");
const colNames = (pragma[0]?.values ?? []).map(r => r[1]);

const findCol = (stem) =>
  colNames.find(c => c.toLowerCase().replace(/[^a-z0-9_]/g, '').startsWith(stem)) ?? stem;

const COL_RAJOITUSTYYPIT = findCol('rajoitustyypit');
const COL_RAJOITUSTYYPPI = findCol('rajoitustyyppi');
const COL_SUURUUS        = findCol('suuruus');

console.log(`\nUsing columns: rajoitustyypit="${COL_RAJOITUSTYYPIT}", rajoitustyyppi="${COL_RAJOITUSTYYPPI}", suuruus="${COL_SUURUUS}"`);

// ---- Query all rows ---------------------------------------------------------
const rows = db.exec(
  `SELECT "${COL_RAJOITUSTYYPIT}" as rajoitustyypit,
          "${COL_RAJOITUSTYYPPI}" as rajoitustyyppi,
          "${COL_SUURUUS}"        as suuruus
   FROM rajoitusalue_a`
)[0];

db.close();

const iconKeyCounts = new Map();

for (const row of rows.values) {
  const rajoitustyypit = row[0] ?? '';
  const rajoitustyyppi = row[1] ?? '';
  const suuruusKmh     = parseSuuruus(row[2]);

  let vlmlajityyppit = parseRajoitustyypitToVlmlajityyppi(String(rajoitustyypit));
  if (vlmlajityyppit.length === 0) {
    vlmlajityyppit = parseRajoitustyypitToVlmlajityyppi(String(rajoitustyyppi));
  }

  if (vlmlajityyppit.length === 0) {
    // Fallback: uses merkki_default (special SVG, not a PNG — always present)
    iconKeyCounts.set('merkki_default', (iconKeyCounts.get('merkki_default') ?? 0) + 1);
    continue;
  }

  for (const vlm of vlmlajityyppit) {
    const key = deriveIconKey(vlm, suuruusKmh);
    iconKeyCounts.set(key, (iconKeyCounts.get(key) ?? 0) + 1);
  }
}

// ---- Compare with public/images/ --------------------------------------------
const imagesDir = path.join(__dirname, '..', 'public', 'images');
const existingPngs = new Set(readdirSync(imagesDir).filter(f => f.endsWith('.png')));

console.log('\n=== ALL ICON KEYS DERIVED FROM RESTRICTION AREAS ===');
const sorted = [...iconKeyCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
const missing = [];

for (const [key, count] of sorted) {
  if (key === 'merkki_default') {
    console.log(`  ~ (fallback/default)  (${count} areas use default)`);
    continue;
  }
  const exists = existingPngs.has(`${key}.png`);
  console.log(`  ${exists ? '✓' : '✗ MISSING'} ${key}  (${count} areas)`);
  if (!exists) missing.push({ key, count });
}

console.log(`\n=== SUMMARY ===`);
console.log(`Total unique icon keys: ${iconKeyCounts.size}`);
console.log(`Keys with PNG present:  ${iconKeyCounts.size - missing.length - (iconKeyCounts.has('merkki_default') ? 1 : 0)}`);
console.log(`Keys MISSING a PNG:     ${missing.length}`);

if (missing.length === 0) {
  console.log('\nAll area icon keys have a matching PNG. ✓');
} else {
  console.log('\nMissing files needed:');
  for (const { key, count } of missing) {
    console.log(`  public/images/${key}.png   (used by ${count} area${count > 1 ? 's' : ''})`);
  }
}
