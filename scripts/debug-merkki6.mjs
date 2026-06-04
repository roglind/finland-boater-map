import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const initSqlJs = require('../node_modules/sql.js/dist/sql-wasm.js');

const res = await fetch('https://roglind.github.io/finland-boater-map/data/rajoitusalue_a.gpkg');
const buf = Buffer.from(await res.arrayBuffer());
const SQL = await initSqlJs();
const db = new SQL.Database(new Uint8Array(buf));

// Discover column names (handle ä encoding)
const pragma = db.exec("PRAGMA table_info(rajoitusalue_a)");
const cols = (pragma[0]?.values ?? []).map(r => r[1]);
const find = stem => cols.find(c => c.toLowerCase().replace(/[^a-z0-9_]/g, '').startsWith(stem)) ?? stem;
const C_TYYPIT  = find('rajoitustyypit');
const C_TYYPPI  = find('rajoitustyyppi');
const C_SUURUUS = find('suuruus');

console.log(`Using: "${C_TYYPIT}", "${C_TYYPPI}", "${C_SUURUUS}"\n`);

// 1. Show distinct (rajoitustyypit, rajoitustyyppi, suuruus) combos for ALL areas
//    that include a "2" type entry AND have a suuruus value
const q1 = db.exec(`
  SELECT "${C_TYYPIT}" as tyypit,
         "${C_TYYPPI}"  as tyyppi,
         "${C_SUURUUS}" as suuruus,
         COUNT(*)       as cnt
  FROM rajoitusalue_a
  WHERE "${C_SUURUUS}" IS NOT NULL AND trim("${C_SUURUUS}") != ''
  GROUP BY "${C_TYYPIT}", "${C_TYYPPI}", "${C_SUURUUS}"
  ORDER BY cnt DESC
`)[0];

console.log('=== Areas WITH a suuruus value: distinct (rajoitustyypit, rajoitustyyppi, suuruus) ===');
if (q1) {
  console.log('rajoitustyypit | rajoitustyyppi | suuruus | count');
  for (const r of q1.values) console.log(r.map(v => String(v ?? '').padEnd(20)).join(' | '));
} else {
  console.log('(no rows)');
}

// 2. Show all distinct rajoitustyypit values across the full dataset
const q2 = db.exec(`
  SELECT "${C_TYYPIT}" as tyypit, COUNT(*) as cnt
  FROM rajoitusalue_a
  GROUP BY "${C_TYYPIT}"
  ORDER BY cnt DESC
`)[0];
console.log('\n=== All distinct rajoitustyypit values in the dataset ===');
if (q2) {
  for (const r of q2.values) console.log(`  "${r[0]}"  → ${r[1]} areas`);
}

db.close();
