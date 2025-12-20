import initSqlJs, { Database } from 'sql.js';
import wkx from 'wkx';
import type { RestrictionArea, TrafficSign } from '../types';
import bbox from '@turf/bbox';
import { polygon, multiPolygon, point } from '@turf/helpers';

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
  try {
    const geometry = wkx.Geometry.parse(Buffer.from(wkb));
    return geometry.toGeoJSON();
  } catch (error) {
    console.error('WKB parse error:', error);
    throw error;
  }
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
    
    // Parse SUURUUS for numeric value
    const suuruusRaw = (row.SUURUUS as string) || '';
    const suuruusMatch = suuruusRaw.match(/(\d+)/);
    const suuruusKmh = suuruusMatch ? parseInt(suuruusMatch[1], 10) : undefined;
    
    // Calculate bbox
    const feat = geometry.type === 'Polygon' 
      ? polygon(geometry.coordinates)
      : multiPolygon(geometry.coordinates);
    const bboxArr = bbox(feat) as [number, number, number, number];
    
    results.push({
      id: row.id as number,
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
  
  const stmt = db.prepare(`
    SELECT 
      fid as id,
      NIMIFI,
      NIMISV,
      VLMLAJITYYPPI,
      VLMTYYPPI,
      RAJOITUSARVO,
      LISAKILMENTEKSTIFI,
      LISAKILMENTEKSTISV,
      SIJAINTIFI,
      SIJAINTISV,
      VAYLALAJI,
      PAATOS,
      VAIKUTUSALUE,
      PATATYYPPI,
      PAKOTYYPPI,
      TKL_NUMERO,
      MITTAUSPAIVA,
      VAYLAT,
      IRROTUS_PVM,
      geom
    FROM vesiliikennemerkit
  `);
  
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const geomWKB = row.geom as Uint8Array;
    const geometry = parseWKB(geomWKB);
    
    const vlmlajityyppi = row.VLMLAJITYYPPI as number;
    const rajoitusarvo = row.RAJOITUSARVO != null ? row.RAJOITUSARVO as number : undefined;
    
    results.push({
      id: row.id as number,
      nimiFi: row.NIMIFI as string,
      nimiSv: row.NIMISV as string,
      vlmlajityyppi,
      vlmtyyppi: row.VLMTYYPPI as number,
      rajoitusarvo,
      lisakilmentekstiFi: row.LISAKILMENTEKSTIFI as string,
      lisakilmentekstiSv: row.LISAKILMENTEKSTISV as string,
      sijaintiFi: row.SIJAINTIFI as string,
      sijaintiSv: row.SIJAINTISV as string,
      vaylalaji: row.VAYLALAJI as string,
      paatos: row.PAATOS as string,
      vaikutusalue: row.VAIKUTUSALUE as string,
      patatyyppi: row.PATATYYPPI as number,
      pakotyyppi: row.PAKOTYYPPI as number,
      tklNumero: row.TKL_NUMERO as number,
      mittauspaiva: row.MITTAUSPAIVA as string,
      vaylat: row.VAYLAT as string,
      irrotusPvm: row.IRROTUS_PVM as string,
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
