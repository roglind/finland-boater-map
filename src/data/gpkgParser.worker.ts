// WKB Parser - Build: 2025-01-07-17-10-MORE-FIX-ORDER1
import initSqlJs, { Database } from 'sql.js';
import proj4 from 'proj4';
import type { RestrictionArea, TrafficSign } from '../types';
import bbox from '@turf/bbox';
import { polygon, multiPolygon } from '@turf/helpers';

// Define ETRS-TM35FIN (EPSG:3067) projection
proj4.defs('EPSG:3067', '+proj=utm +zone=35 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

// Function to transform coordinates from ETRS-TM35FIN to WGS84
function transformCoordinates(coords: number[]): number[] {
  if (coords.length === 2) {
    // Single point [x, y] -> [lng, lat]
    const [x, y] = coords;
    
    // Check if input is valid
    if (!isFinite(x) || !isFinite(y)) {
      console.error('Invalid input coordinates:', x, y);
      return [0, 0]; // Return null island as fallback
    }
    
    // Check if already in WGS84 range
    if (x >= -180 && x <= 180 && y >= -90 && y <= 90) {
      return coords; // Already in WGS84
    }
    
    try {
      const [lng, lat] = proj4('EPSG:3067', 'EPSG:4326', [x, y]);
      
      // Validate output
      if (!isFinite(lng) || !isFinite(lat)) {
        console.error('Transform produced invalid coordinates:', { input: [x, y], output: [lng, lat] });
        return [0, 0]; // Return null island as fallback
      }
      
      return [lng, lat];
    } catch (error) {
      console.error('Transform error for coordinates:', x, y, error);
      return [0, 0]; // Return null island as fallback
    }
  }
  // Handle nested arrays recursively
  return coords.map(c => transformCoordinates(c as any)) as any;
}

/** GeoJSON and MapLibre expect [lng, lat]. Some GeoPackages store points as (lat, lng). */
function ensureLngLatOrder(coords: number[]): number[] {
  if (coords.length !== 2) return coords;
  const [a, b] = coords;
  // Finland: lat 60–70, lng 18–32. If first is lat and second is lng, swap to [lng, lat].
  if (a >= 55 && a <= 75 && b >= 18 && b <= 32) {
    return [b, a];
  }
  return coords;
}

interface ParseMessage {
  type: 'parse';
  dataType: 'rajoitus' | 'vesiliikenne';
  arrayBuffer: ArrayBuffer;
}

interface ParseResultMessage {
  type: 'result';
  dataType: 'rajoitus' | 'vesiliikenne';
  data: RestrictionArea[] | TrafficSign[];
}

interface ParseErrorMessage {
  type: 'error';
  error: string;
}

  // Parse WKB geometry to GeoJSON
  function parseWKB(wkb: Uint8Array): any {
    const view = new DataView(wkb.buffer, wkb.byteOffset, wkb.byteLength);
    let offset = 0;
  
    // GeoPackage Binary Format has a special header
    // Check for GeoPackage magic bytes 'GP'
    const magic1 = view.getUint8(offset);
    const magic2 = view.getUint8(offset + 1);
  
    if (magic1 === 0x47 && magic2 === 0x50) {
      // This is GeoPackage Binary Format
    
      // Skip GeoPackage header
      const flags = view.getUint8(offset + 3);
      offset += 8; // Skip 8-byte header
    
      // Skip envelope if present (flags & 0x0E)
      const envelopeType = (flags >> 1) & 0x07;
      if (envelopeType === 1) offset += 32; // XY envelope
      else if (envelopeType === 2) offset += 48; // XYZ envelope
      else if (envelopeType === 3) offset += 48; // XYM envelope  
      else if (envelopeType === 4) offset += 64; // XYZM envelope
    
    }
  
    // Now read standard WKB
    const byteOrder = view.getUint8(offset);
    offset += 1;
    const littleEndian = byteOrder === 1;
  
    let geomType = view.getUint32(offset, littleEndian);
    offset += 4;
  
  // Rest of the function stays the same...  
  
  // GeoPackage flags
  const hasZ = (geomType & 0x20000000) !== 0;
  const hasM = (geomType & 0x10000000) !== 0;
  const hasSRID = (geomType & 0x40000000) !== 0;
  
  
  const baseType = geomType & 0x07;
  
  if (hasSRID) {
    offset += 4;
  }
  
  geomType = baseType;
  
  // Point (type 1)
  if (geomType === 1) {
    const x = view.getFloat64(offset, littleEndian);
    offset += 8;
    const y = view.getFloat64(offset, littleEndian);
    offset += 8;
    if (hasZ) offset += 8;
    if (hasM) offset += 8;
    return { type: 'Point', coordinates: [x, y] };
  }
  
  // Polygon (type 3)
  if (geomType === 3) {
    const numRings = view.getUint32(offset, littleEndian);
    offset += 4;
    const rings = [];
  
    for (let i = 0; i < numRings; i++) {
      const numPoints = view.getUint32(offset, littleEndian);
      offset += 4;
      const ring = [];
    
      for (let j = 0; j < numPoints; j++) {
        if (offset + 16 > view.byteLength) {
          throw new Error('Buffer overflow at point ' + j);
        }
        const x = view.getFloat64(offset, littleEndian);
        offset += 8;
        const y = view.getFloat64(offset, littleEndian);
        offset += 8;
        if (hasZ) offset += 8;
        if (hasM) offset += 8;
      
        ring.push([x, y]);
      }
      rings.push(ring);
    }
    return { type: 'Polygon', coordinates: rings };
  }
  
  // MultiPolygon (type 6)
  if (geomType === 6) {
    const numPolygons = view.getUint32(offset, littleEndian);
    offset += 4;
    const polygons = [];
    
    for (let p = 0; p < numPolygons; p++) {
      const innerByteOrder = view.getUint8(offset);
      offset += 1;
      const innerLittleEndian = innerByteOrder === 1;
      
      let innerGeomType = view.getUint32(offset, innerLittleEndian);
      offset += 4;
      
      const innerHasZ = (innerGeomType & 0x20000000) !== 0;
      const innerHasM = (innerGeomType & 0x10000000) !== 0;
      const innerHasSRID = (innerGeomType & 0x40000000) !== 0;
      
      if (innerHasSRID) {
        offset += 4;
      }
      
      const numRings = view.getUint32(offset, innerLittleEndian);
      offset += 4;
      const rings = [];
      
      for (let i = 0; i < numRings; i++) {
        const numPoints = view.getUint32(offset, innerLittleEndian);
        offset += 4;
        const ring = [];
        
        for (let j = 0; j < numPoints; j++) {
          const x = view.getFloat64(offset, innerLittleEndian);
          offset += 8;
          const y = view.getFloat64(offset, innerLittleEndian);
          offset += 8;
          if (innerHasZ) offset += 8;
          if (innerHasM) offset += 8;
          ring.push([x, y]);
        }
        rings.push(ring);
      }
      polygons.push(rings);
    }
    
    return { type: 'MultiPolygon', coordinates: polygons };
  }
  
  throw new Error(`Unsupported geometry type: ${geomType}`);
}

/**
 * Discover the actual column names in rajoitusalue_a at runtime via PRAGMA.
 * sql.js returns getAsObject() keys in the schema's actual case, not the case
 * used in the SELECT statement. We therefore use explicit lowercase ASCII
 * aliases for all columns to guarantee consistent key names.
 *
 * The three columns with Finnish special characters (ä) are looked up by their
 * ASCII stem so they work regardless of encoding or exact casing in the file.
 */
function discoverFinnishColumns(db: Database): {
  lisatieto: string;
  alkupvm: string;
  loppupvm: string;
} {
  const result = db.exec("PRAGMA table_info(rajoitusalue_a)");
  const colNames: string[] = (result[0]?.values ?? []).map(
    (r) => (r[1] as string) ?? ''
  );

  // Match by ASCII stem (case-insensitive) to cope with ä encoding variants
  const find = (stem: string) =>
    colNames.find((c) => c.toLowerCase().replace(/[^a-z0-9_]/g, '').startsWith(stem)) ?? stem;

  return {
    lisatieto:  find('lisatieto'),
    alkupvm:    find('alkup'),
    loppupvm:   find('loppup'),
  };
}

function parseRestrictionAreas(db: Database): RestrictionArea[] {
  const results: RestrictionArea[] = [];

  // Discover actual Finnish-character column names at runtime
  const finnishCols = discoverFinnishColumns(db);

  const sql = `
    SELECT
      fid                             as id,
      RAJOITUSTYYPPI                  as rajoitustyyppi,
      RAJOITUSTYYPIT                  as rajoitustyypit,
      SUURUUS                         as suuruus,
      PITUUS                          as pituus,
      POIKKEUS                        as poikkeus,
      "${finnishCols.lisatieto}"      as lisatieto,
      PAATOSTILA                      as paatostila,
      "${finnishCols.alkupvm}"        as alkupaivamaara,
      "${finnishCols.loppupvm}"       as loppupaivamaara,
      DIAARINUMERO                    as diaarinumero,
      TIETOLAHDE                      as tietolahde,
      JNRO                            as jnro,
      NIMISIJAINTI                    as nimisijainti,
      IRROTUS_PVM                     as irrotus_pvm,
      geom
    FROM rajoitusalue_a
  `;

  const stmt = db.prepare(sql);

  while (stmt.step()) {
    const row = stmt.getAsObject();
    const geomWKB = row.geom as Uint8Array;
    const geometry = parseWKB(geomWKB);

    // Transform coordinates from ETRS-TM35FIN to WGS84
    geometry.coordinates = transformCoordinates(geometry.coordinates);

    // Parse suuruus for numeric value
    const uniqueId = row.id ?? results.length;
    const safeId = typeof uniqueId === 'number' ? uniqueId : parseInt(String(uniqueId)) || results.length;
    const suuruusRaw = (row.suuruus as string) || '';
    const suuruusMatch = suuruusRaw.match(/(\d+)/);
    const suuruusKmh = suuruusMatch ? parseInt(suuruusMatch[1], 10) : undefined;

    // Calculate bbox
    const feat = geometry.type === 'Polygon'
      ? polygon(geometry.coordinates)
      : multiPolygon(geometry.coordinates);
    const bboxArr = bbox(feat) as [number, number, number, number];

    results.push({
      id: safeId,
      rajoitustyyppi: (row.rajoitustyyppi as string) || '',
      rajoitustyypit: (row.rajoitustyypit as string) || '',
      suuruusKmh,
      suuruusRaw,
      pituusRaw:    row.pituus        as string,
      poikkeus:     row.poikkeus      as string,
      lisatieto:    row.lisatieto     as string,
      paatostila:   row.paatostila    as string,
      alkuPvm:      row.alkupaivamaara  as string,
      loppuPvm:     row.loppupaivamaara as string,
      diaarinumero: row.diaarinumero  as string,
      tietolahde:   row.tietolahde    as string,
      jnro:         row.jnro          as number,
      nimisijainti: row.nimisijainti  as string,
      irrotusPvm:   row.irrotus_pvm   as string,
      geometry: geometry as any,
      bbox: bboxArr
    });
  }

  stmt.free();
  return results;
}

function deriveIconKey(vlmlajityyppi: number, rajoitusarvo?: number): string {
  if (rajoitusarvo != null) {
    return `merkki${vlmlajityyppi}_${rajoitusarvo}`;
  }
  return `merkki${vlmlajityyppi}`;
}

function parseNumericSuffixValue(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.trunc(raw);
  }
  if (typeof raw === 'string') {
    const match = raw.match(/(\d+)/);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

const SUURUUS_SUFFIX_TYPES = new Set([11, 15, 16, 17, 19]);

function parseTrafficSigns(db: Database): TrafficSign[] {
  const results: TrafficSign[] = [];
  
  const stmt = db.prepare(`SELECT * FROM vesiliikennemerkit`);
  
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const geomWKB = row.geom as Uint8Array;
    const geometry = parseWKB(geomWKB);

    // Transform coordinates and ensure [lng, lat] order (some GPKG use lat, lng)
    let coords = transformCoordinates(geometry.coordinates) as number[];
    coords = ensureLngLatOrder(coords);
    geometry.coordinates = coords;

    const uniqueId = row.id || row.fid || results.length;
    const safeId = typeof uniqueId === 'number' ? uniqueId : parseInt(String(uniqueId)) || results.length;
    if (!Array.isArray(coords) || coords.length !== 2 || !isFinite(coords[0]) || !isFinite(coords[1])) {
      continue;
    }
    const vlmlajityyppi = (row.VLMLAJITYYPPI || row.vlmlajityyppi || 0) as number;
    const rajoitusarvo = parseNumericSuffixValue(row.RAJOITUSARVO ?? row.rajoitusarvo);
    const suuruus = parseNumericSuffixValue(row.SUURUUS ?? row.suuruus);
    const iconSuffixSource = SUURUUS_SUFFIX_TYPES.has(vlmlajityyppi)
      ? (suuruus ?? rajoitusarvo)
      : rajoitusarvo;
    
    results.push({
      id: safeId,
      nimiFi: (row.NIMIFI || row.NIMI_FI || row.nimifi || row.nimi_fi || '') as string,
      nimiSv: (row.NIMISV || row.NIMI_SV || row.nimisv || row.nimi_sv || '') as string,
      vlmlajityyppi,
      vlmtyyppi: row.VLMTYYPPI || row.vlmtyyppi || 0 as number,
      rajoitusarvo,
      lisakilventekstiFi: (row.LISAKILVENTEKSTIFI || row.LISAKILVENTEKSTI_FI || row.lisakilventekstifi || row.lisakilventeksti_fi || '') as string,
      lisakilventekstiSv: (row.LISAKILVENTEKSTISV || row.LISAKILVENTEKSTI_SV || row.lisakilventekstisv || row.lisakilventeksti_sv || '') as string,
      sijaintiFi: (row.SIJAINTIFI || row.SIJAINTI_FI || row.sijaintifi || row.sijainti_fi || '') as string,
      sijaintiSv: (row.SIJAINTISV || row.SIJAINTI_SV || row.sijaintisv || row.sijainti_sv || '') as string,
      vaylalaji: (row.VAYLALAJI || row.vaylalaji || '') as string,
      paatos: (row.PAATOS || row.paatos || '') as string,
      vaikutusalue: (row.VAIKUTUSALUE || row.vaikutusalue || '') as string,
      patatyyppi: row.PATATYYPPI || row.patatyyppi || 0 as number,
      pakotyyppi: row.PAKOTYYPPI || row.pakotyyppi || 0 as number,
      tklNumero: row.TKL_NUMERO || row.tkl_numero || 0 as number,
      mittauspaiva: (row.MITTAUSPAIVA || row.mittauspaiva || '') as string,
      vaylat: (row.VAYLAT || row.vaylat || '') as string,
      irrotusPvm: (row.IRROTUS_PVM || row.irrotus_pvm || '') as string,
      geometry: geometry as any,
      iconKey: deriveIconKey(vlmlajityyppi, iconSuffixSource)
    });
  }
  
  stmt.free();
  return results;
}

async function parseGeoPackage(arrayBuffer: ArrayBuffer, dataType: 'rajoitus' | 'vesiliikenne') {
  const SQL = await initSqlJs({
    locateFile: (file) => `https://sql.js.org/dist/${file}`
  });
  
  const db = new SQL.Database(new Uint8Array(arrayBuffer));
  
  try {
    if (dataType === 'rajoitus') {
      return parseRestrictionAreas(db);
    } else {
      return parseTrafficSigns(db);
    }
  } finally {
    db.close();
  }
}

self.onmessage = async (e: MessageEvent<ParseMessage>) => {
  try {
    const { dataType, arrayBuffer } = e.data;
    const data = await parseGeoPackage(arrayBuffer, dataType);
    
    const result: ParseResultMessage = {
      type: 'result',
      dataType,
      data
    };
    
    self.postMessage(result);
  } catch (error) {
    const errorMsg: ParseErrorMessage = {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    self.postMessage(errorMsg);
  }
};
