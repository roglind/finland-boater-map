import distance from '@turf/distance';
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

/** Convert TrafficSign[] to NearbySign[] (distance, iconUrl, vlmtyyppi filter); no radius filter. */
export function signsToNearbySigns(
  signs: TrafficSign[],
  position: BoatPosition,
  filters: AppFilters
): NearbySign[] {
  const boatPoint = point([position.lng, position.lat]);
  const nearby: NearbySign[] = [];
  for (const sign of signs) {
    if (filters.selectedVlmtyyppi.size > 0 && !filters.selectedVlmtyyppi.has(sign.vlmtyyppi)) {
      continue;
    }
    const [lng, lat] = ensureLngLat(sign.geometry.coordinates);
    if (!isValidLngLat([lng, lat])) continue;
    const dist = distance(boatPoint, point([lng, lat]), { units: 'meters' });
    nearby.push({
      ...sign,
      geometry: { type: 'Point', coordinates: [lng, lat] },
      distance: Math.round(dist),
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
    // Apply VLMTYYPPI filter
    if (filters.selectedVlmtyyppi.size > 0) {
      if (!filters.selectedVlmtyyppi.has(sign.vlmtyyppi)) {
        continue;
      }
    }
    
    const [lng, lat] = ensureLngLat(sign.geometry.coordinates);
    if (!isValidLngLat([lng, lat])) continue;
    const signPoint = point([lng, lat]);
    const dist = distance(boatPoint, signPoint, { units: 'meters' });
    
    if (dist <= filters.nearbyRadius) {
      nearby.push({
        ...sign,
        geometry: { type: 'Point', coordinates: [lng, lat] },
        distance: Math.round(dist),
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
  return `${baseUrl}icons/${iconKey}.png`;
}

export function getDefaultIconUrl(): string {
  return `${baseUrl}icons/merkki_default.png.svg`;
}

export function getIconUrlWithFallback(iconKey: string): string {
  return getIconUrl(iconKey);
}

export function formatSignName(sign: NearbySign): string {
  if (sign.nimiFi && sign.nimiFi.trim().length > 0) return sign.nimiFi.trim();
  if (sign.nimiSv && sign.nimiSv.trim().length > 0) return sign.nimiSv.trim();
  return `Merkkityyppi ${sign.vlmtyyppi}`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

// Get unique VLMTYYPPI values for filter UI
export function getUniqueVlmtyyppi(signs: TrafficSign[]): number[] {
  const unique = new Set<number>();
  signs.forEach(sign => unique.add(sign.vlmtyyppi));
  return Array.from(unique).sort((a, b) => a - b);
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
