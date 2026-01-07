// FIX SPELLING ERRORS
import type { Point, Polygon, MultiPolygon } from 'geojson';

export interface RestrictionArea {
  id: number;
  rajoitustyyppi: string;
  rajoitustyypit: string; // raw string e.g. "01, 02"
  suuruusKmh?: number; // parsed from SUURUUS when numeric
  suuruusRaw: string;
  pituusRaw?: string;
  poikkeus?: string;
  lisatieto?: string;
  paatostila?: string;
  alkuPvm?: string; // ISO timestamp
  loppuPvm?: string; // ISO timestamp or null
  diaarinumero?: string;
  tietolahde?: string;
  jnro?: number;
  nimisijainti?: string;
  irrotusPvm?: string;
  geometry: Polygon | MultiPolygon;
  bbox: [number, number, number, number]; // [minX, minY, maxX, maxY]
}

export interface TrafficSign {
  id: number;
  nimiFi?: string;
  nimiSv?: string;
  vlmlajityyppi: number;
  vlmtyyppi: number;
  rajoitusarvo?: number; // nullable
  lisakilventekstiFi?: string;
  lisakilventekstiSv?: string;
  sijaintiFi?: string;
  sijaintiSv?: string;
  vaylalaji?: string;
  paatos?: string;
  vaikutusalue?: string;
  patatyyppi?: number;
  pakotyyppi?: number;
  tklNumero?: number;
  mittauspaiva?: string;
  vaylat?: string;
  irrotusPvm?: string;
  geometry: Point;
  iconKey: string; // derived
}

export interface UpdateStatus {
  isUpdating: boolean;
  progress: number; // 0-100
  message: string;
  error?: string;
}

export interface AppFilters {
  ammattiliikenne: boolean;
  vesiskootteri: boolean;
  selectedVlmtyyppi: Set<number>;
  nearbyRadius: number; // meters, default 250
}

export interface BoatPosition {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface ApplicableRestriction extends RestrictionArea {
  distance?: number; // if not inside, distance to boundary
  isPrimary?: boolean; // for speed limits, marks the lowest one
}

export interface NearbySign extends TrafficSign {
  distance: number; // meters
  iconUrl: string;
}

export type BBox = [number, number, number, number];

export interface SpatialIndexNode {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: number;
}
