// WKB Parser - Build: 2025-01-07-17-10-MORE-DEBUG
import initSqlJs, { Database } from 'sql.js';
import type { RestrictionArea, TrafficSign } from '../types';
import bbox from '@turf/bbox';
import { polygon, multiPolygon } from '@turf/helpers';

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
    console.log('DEBUG: Skipped SRID');
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
          console.error('DEBUG: Would read past buffer at point', j, 'offset:', offset, 'buffer length:', view.byteLength);
          throw new Error('Buffer overflow at point ' + j);
        }
      
        const x = view.getFloat64(offset, littleEndian);
        offset += 8;
        const y = view.getFloat64(offset, littleEndian);
        offset += 8;
      
        console.log('DEBUG: Point', j, '- x:', x, 'y:', y, 'offset now:', offset);
      
        if (hasZ) {
          console.log('DEBUG: Skipping Z coordinate');
          offset += 8;
        }
        if (hasM) {
          console.log('DEBUG: Skipping M coordinate');
          offset += 8;
        }
      
        ring.push([x, y]);
      }
      rings.push(ring);
    }
  
    console.log('DEBUG: Polygon parsed successfully');
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

function parseRestrictionAreas(db: Database): RestrictionArea[] {
  const results: RestrictionArea[] = [];
  
  const stmt = db.prepare(`
    SELECT 
      fid as id,
      RAJOITUSTYYPPI,
      RAJOITUSTYYPIT,
      SUURUUS,
      PITUUS,
      POIKKEUS,
      "LISÄTIETO",
      PAATOSTILA,
      "ALKUPÄIVÄMÄÄRÄ",
      "LOPPUPÄIVÄMÄÄRÄ",
      DIAARINUMERO,
      TIETOLAHDE,
      JNRO,
      NIMISIJAINTI,
      IRROTUS_PVM,
      geom
    FROM rajoitusalue_a
  `);
  
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const geomWKB = row.geom as Uint8Array;
    const geometry = parseWKB(geomWKB);
    
    if (results.length === 0) {
      console.log('First geometry sample:', JSON.stringify(geometry));
      console.log('First bbox sample:', bboxArr);
    }

    // Parse SUURUUS for numeric value
    const uniqueId = row.id || row.fid || results.length;
    const safeId = typeof uniqueId === 'number' ? uniqueId : parseInt(String(uniqueId)) || results.length;
    const suuruusRaw = (row.SUURUUS as string) || '';
    const suuruusMatch = suuruusRaw.match(/(\d+)/);
    const suuruusKmh = suuruusMatch ? parseInt(suuruusMatch[1], 10) : undefined;
    
    // Calculate bbox
    const feat = geometry.type === 'Polygon' 
      ? polygon(geometry.coordinates)
      : multiPolygon(geometry.coordinates);
    const bboxArr = bbox(feat) as [number, number, number, number];
    
    results.push({
      id: safeId,
      rajoitustyyppi: (row.RAJOITUSTYYPPI as string) || '',
      rajoitustyypit: (row.RAJOITUSTYYPIT as string) || '',
      suuruusKmh,
      suuruusRaw,
      pituusRaw: row.PITUUS as string,
      poikkeus: row.POIKKEUS as string,
      lisatieto: row['LISÄTIETO'] as string,
      paatostila: row.PAATOSTILA as string,
      alkuPvm: row['ALKUPÄIVÄMÄÄRÄ'] as string,
      loppuPvm: row['LOPPUPÄIVÄMÄÄRÄ'] as string,
      diaarinumero: row.DIAARINUMERO as string,
      tietolahde: row.TIETOLAHDE as string,
      jnro: row.JNRO as number,
      nimisijainti: row.NIMISIJAINTI as string,
      irrotusPvm: row.IRROTUS_PVM as string,
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

function parseTrafficSigns(db: Database): TrafficSign[] {
  const results: TrafficSign[] = [];
  
  const stmt = db.prepare(`SELECT * FROM vesiliikennemerkit`);
  
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const geomWKB = row.geom as Uint8Array;
    const geometry = parseWKB(geomWKB);
    const uniqueId = row.id || row.fid || results.length;
    const safeId = typeof uniqueId === 'number' ? uniqueId : parseInt(String(uniqueId)) || results.length;
    const vlmlajityyppi = row.VLMLAJITYYPPI as number;
    const rajoitusarvo = row.RAJOITUSARVO != null ? row.RAJOITUSARVO as number : undefined;
    
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
      iconKey: deriveIconKey(vlmlajityyppi, rajoitusarvo)
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
