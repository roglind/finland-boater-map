// ADD DEBUG
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import type { RestrictionArea, ApplicableRestriction, AppFilters, BoatPosition } from '../types';

export function isRestrictionApplicable(
  restriction: RestrictionArea,
  position: BoatPosition,
  filters: AppFilters,
  now: Date = new Date()
): boolean {
  // Check if point is inside polygon
  const pt = point([position.lng, position.lat]);
  const isInside = booleanPointInPolygon(pt, restriction.geometry as any);
  
  if (!isInside) {
    return false;
  }
  
  // Check date validity
  if (restriction.alkuPvm) {
    const startDate = new Date(restriction.alkuPvm);
    if (now < startDate) {
      return false;
    }
  }
  
  if (restriction.loppuPvm) {
    const endDate = new Date(restriction.loppuPvm);
    if (now > endDate) {
      return false;
    }
  }
  
  // Apply Ammattiliikenne filter
  if (!filters.ammattiliikenne && restriction.poikkeus) {
    const poikkeusLower = restriction.poikkeus.toLowerCase();
    if (poikkeusLower.includes('huvi')) {
      return false;
    }
  }
  
  // Apply Vesiskootteri filter
  if (!filters.vesiskootteri && restriction.rajoitustyyppi) {
    const rajoitustyyppiLower = restriction.rajoitustyyppi.toLowerCase();
    if (rajoitustyyppiLower.includes('vesiskootterilla')) {
      return false;
    }
  }
  
  return true;
}

export function getApplicableRestrictions(
  restrictions: RestrictionArea[],
  position: BoatPosition,
  filters: AppFilters
): ApplicableRestriction[] {
  console.log('🔍 getApplicableRestrictions called with', candidateAreas.length, 'candidates');
  console.log('Sample candidate:', candidateAreas[0]);
  console.log('Position:', position);
  console.log('Filters:', filters);
  
  const now = new Date();
  const applicable: ApplicableRestriction[] = [];
  
  for (const restriction of restrictions) {
    if (isRestrictionApplicable(restriction, position, filters, now)) {
      applicable.push({ ...restriction });
    }
  }
  
  // Mark primary speed limit (lowest)
  const speedLimits = applicable.filter(r => r.suuruusKmh != null);
  if (speedLimits.length > 0) {
    const lowest = speedLimits.reduce((min, r) => 
      (r.suuruusKmh! < min.suuruusKmh!) ? r : min
    );
    lowest.isPrimary = true;
  }
  
  // Sort: primary first, then by speed limit, then by type
  applicable.sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    
    if (a.suuruusKmh != null && b.suuruusKmh != null) {
      return a.suuruusKmh - b.suuruusKmh;
    }
    if (a.suuruusKmh != null) return -1;
    if (b.suuruusKmh != null) return 1;
    
    return a.rajoitustyyppi.localeCompare(b.rajoitustyyppi, 'fi');
  });
  
  return applicable;
}

export function formatRestriction(restriction: ApplicableRestriction): string {
  if (restriction.suuruusKmh != null) {
    return `Nopeusrajoitus ${restriction.suuruusKmh} km/h`;
  }
  
  return restriction.rajoitustyyppi || 'Rajoitus';
}
