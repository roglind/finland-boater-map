import distance from '@turf/distance';
import { point } from '@turf/helpers';
import type { TrafficSign, NearbySign, BoatPosition, AppFilters } from '../types';

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
    
    const signPoint = point(sign.geometry.coordinates);
    const dist = distance(boatPoint, signPoint, { units: 'meters' });
    
    if (dist <= filters.nearbyRadius) {
      nearby.push({
        ...sign,
        distance: Math.round(dist),
        iconUrl: getIconUrl(sign.iconKey)
      });
    }
  }
  
  // Sort by distance
  nearby.sort((a, b) => a.distance - b.distance);
  
  return nearby;
}

export function getIconUrl(iconKey: string): string {
  // Try with rajoitusarvo first (e.g., merkki12_50.png)
  // Fallback to without rajoitusarvo (e.g., merkki12.png)
  // Final fallback to default
  return `/icons/${iconKey}.png`;
}

export function getIconUrlWithFallback(iconKey: string): string {
  // In real implementation, this would check if file exists
  // For now, return the primary URL
  // The browser will handle 404s naturally, but we should implement
  // an error handler in the Image component
  return getIconUrl(iconKey);
}

export function formatSignName(sign: NearbySign): string {
  return sign.nimiFi || sign.nimiSv || `Merkki ${sign.vlmlajityyppi}`;
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
