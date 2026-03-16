import distance from '@turf/distance';
import turfBearing from '@turf/bearing';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import type { TrafficSign, NearbySign, BoatPosition, AppFilters, RestrictionArea } from '../types';

/** Ensure [lng, lat] for Finland; some data is (lat, lng). */
function ensureLngLat(coord: number[]): [number, number] {
  if (coord.length !== 2) return [coord[0], coord[1]];
  const [a, b] = coord;
  if (a >= 55 && a <= 75 && b >= 18 && b <= 32) return [b, a];
  return [a, b];
}

function isValidLngLat([lng, lat]: [number, number]): boolean {
  return Number.isFinite(lng) && Number.isFinite(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

/** Signs whose position is inside any of the given restriction areas (used when boat is in an area). */
export function getSignsInAreas(
  areas: RestrictionArea[],
  allSigns: TrafficSign[]
): TrafficSign[] {
  if (areas.length === 0) return [];
  const out: TrafficSign[] = [];
  for (const sign of allSigns) {
    const [lng, lat] = ensureLngLat(sign.geometry.coordinates);
    if (!isValidLngLat([lng, lat])) continue;
    const pt = point([lng, lat]);
    for (const area of areas) {
      if (booleanPointInPolygon(pt, area.geometry as any)) {
        out.push(sign);
        break;
      }
    }
  }
  return out;
}

/** Convert TrafficSign[] to NearbySign[] (distance, bearing, iconUrl); no radius filter. */
export function signsToNearbySigns(
  signs: TrafficSign[],
  position: BoatPosition,
  filters: AppFilters
): NearbySign[] {
  const boatPoint = point([position.lng, position.lat]);
  const nearby: NearbySign[] = [];
  for (const sign of signs) {
    const [lng, lat] = ensureLngLat(sign.geometry.coordinates);
    if (!isValidLngLat([lng, lat])) continue;
    const signPoint = point([lng, lat]);
    const dist = distance(boatPoint, signPoint, { units: 'meters' });
    const bear = (turfBearing(boatPoint, signPoint) + 360) % 360;
    nearby.push({
      ...sign,
      geometry: { type: 'Point', coordinates: [lng, lat] },
      distance: Math.round(dist),
      bearing: Math.round(bear),
      iconUrl: getIconUrl(sign.iconKey)
    });
  }
  nearby.sort((a, b) => a.distance - b.distance);
  return nearby;
}

export function getNearbySignsWithDistance(
  signs: TrafficSign[],
  position: BoatPosition,
  filters: AppFilters
): NearbySign[] {
  const boatPoint = point([position.lng, position.lat]);
  const nearby: NearbySign[] = [];
  
  for (const sign of signs) {
    const [lng, lat] = ensureLngLat(sign.geometry.coordinates);
    if (!isValidLngLat([lng, lat])) continue;
    const signPoint = point([lng, lat]);
    const dist = distance(boatPoint, signPoint, { units: 'meters' });
    
    if (dist <= filters.nearbyRadius) {
      const bear = (turfBearing(boatPoint, signPoint) + 360) % 360;
      nearby.push({
        ...sign,
        geometry: { type: 'Point', coordinates: [lng, lat] },
        distance: Math.round(dist),
        bearing: Math.round(bear),
        iconUrl: getIconUrl(sign.iconKey)
      });
    }
  }
  
  // Sort by distance
  nearby.sort((a, b) => a.distance - b.distance);
  
  return nearby;
}

const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/*$/, '/');

export function getIconUrl(iconKey: string): string {
  return `${baseUrl}images/${iconKey}.png`;
}

export function getDefaultIconUrl(): string {
  return `${baseUrl}images/merkki_default.svg`;
}

export function getIconUrlWithFallback(iconKey: string): string {
  return getIconUrl(iconKey);
}

export function formatSignName(sign: NearbySign): string {
  const isCodeLike = (value?: string): boolean => {
    if (!value) return false;
    const trimmed = value.trim();
    return /^[A-Z]{2,}\d+$/i.test(trimmed);
  };

  if (sign.nimiFi && sign.nimiFi.trim().length > 0 && !isCodeLike(sign.nimiFi)) return sign.nimiFi.trim();
  if (sign.nimiSv && sign.nimiSv.trim().length > 0 && !isCodeLike(sign.nimiSv)) return sign.nimiSv.trim();
  if (sign.lisakilventekstiFi && sign.lisakilventekstiFi.trim().length > 0) return sign.lisakilventekstiFi.trim();
  if (sign.sijaintiFi && sign.sijaintiFi.trim().length > 0) return sign.sijaintiFi.trim();
  if (sign.vaikutusalue && sign.vaikutusalue.trim().length > 0) return sign.vaikutusalue.trim();
  return `Merkkityyppi ${sign.vlmtyyppi}`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

const COMPASS_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function bearingToCompass(degrees: number): string {
  const index = Math.round(((degrees % 360) + 360) % 360 / 45) % 8;
  return COMPASS_LABELS[index];
}


export function mergeNearbySigns(primary: NearbySign[], secondary: NearbySign[]): NearbySign[] {
  const byId = new Map<number, NearbySign>();
  for (const sign of [...primary, ...secondary]) {
    const existing = byId.get(sign.id);
    if (!existing || sign.distance < existing.distance) {
      byId.set(sign.id, sign);
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.distance - b.distance);
}
