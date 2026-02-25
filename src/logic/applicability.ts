import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import type { RestrictionArea, ApplicableRestriction, AppFilters, BoatPosition } from '../types';

export function textContainsJetSki(restriction: RestrictionArea): boolean {
  const parts = [
    restriction.rajoitustyyppi,
    restriction.rajoitustyypit,
    restriction.poikkeus,
    restriction.lisatieto
  ].filter(Boolean) as string[];
  const combined = parts.join(' ').toLowerCase();
  return combined.includes('vesiskootterilla');
}

export function isRestrictionApplicable(
  restriction: RestrictionArea,
  position: BoatPosition,
  filters: AppFilters,
  now: Date = new Date()
): boolean {
  const pt = point([position.lng, position.lat]);
  const isInside = booleanPointInPolygon(pt, restriction.geometry as any);
  if (!isInside) return false;

  if (restriction.alkuPvm) {
    const startDate = new Date(restriction.alkuPvm);
    if (now < startDate) return false;
  }
  if (restriction.loppuPvm) {
    const endDate = new Date(restriction.loppuPvm);
    if (now > endDate) return false;
  }

  if (!filters.ammattiliikenne && restriction.poikkeus) {
    if (restriction.poikkeus.toLowerCase().includes('huvi')) return false;
  }

  if (!filters.vesiskootteri && textContainsJetSki(restriction)) {
    return false;
  }

  return true;
}

export function getApplicableRestrictions(
  restrictions: RestrictionArea[],
  position: BoatPosition,
  filters: AppFilters
): ApplicableRestriction[] {
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
