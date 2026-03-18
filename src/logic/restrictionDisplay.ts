import type { ApplicableRestriction } from '../types';
import { getIconUrl, getDefaultIconUrl } from './nearbySigns';

/** vlmlajityyppi values that use suuruus (speed/value) in the icon key. Includes 3, 12 per ICONS.md. */
const SUURUUS_SUFFIX_TYPES = new Set([3, 11, 12, 15, 16, 17, 19]);

/**
 * Translation map: rajoitustyypit (from restriction areas) -> vlmtyyppi/vlmlajityyppi (for traffic sign display).
 * Used to display the correct traffic sign icons for each restriction area.
 * Exported for use when matching signs to restriction areas.
 */
export const RAJOITUSTYYPIT_TO_VLMLAJITYYPPI: Record<number, number> = {
  1: 11,
  2: 6,
  3: 8,
  4: 10,
  5: 9,
  6: 1,
  7: 2,
  8: 3,
  9: 4,
  10: 5,
  11: 0
};

export interface RestrictionDisplayItem {
  vlmlajityyppi: number;
  iconKey: string;
  iconUrl: string; // Same path as traffic signs - uses getIconUrl from nearbySigns
  label: string;
  poikkeus?: string;
  lisatieto?: string;
}

/**
 * Parse rajoitustyypit string and translate to vlmlajityyppi using RAJOITUSTYYPIT_TO_VLMLAJITYYPPI.
 * E.g. "01, 02" -> [11, 6] (01->11, 02->6)
 */
function parseRajoitustyypitToVlmlajityyppi(raw: string): number[] {
  if (!raw || typeof raw !== 'string') return [];
  const parts = raw.split(/[,\s;]+/).map((p) => p.trim()).filter(Boolean);
  const result: number[] = [];
  const seen = new Set<number>();
  for (const p of parts) {
    const n = parseInt(p, 10);
    if (!Number.isFinite(n) || n < 1 || n > 11) continue;
    const vlmlajityyppi = RAJOITUSTYYPIT_TO_VLMLAJITYYPPI[n];
    if (vlmlajityyppi !== undefined && vlmlajityyppi !== 0 && !seen.has(vlmlajityyppi)) {
      seen.add(vlmlajityyppi);
      result.push(vlmlajityyppi);
    }
  }
  return result;
}

function deriveIconKey(vlmlajityyppi: number, suuruusKmh?: number): string {
  if (SUURUUS_SUFFIX_TYPES.has(vlmlajityyppi) && suuruusKmh != null && suuruusKmh > 0) {
    return `merkki${vlmlajityyppi}_${suuruusKmh}`;
  }
  return `merkki${vlmlajityyppi}`;
}

function buildLabel(
  vlmlajityyppi: number,
  suuruusKmh?: number,
  suuruusRaw?: string,
  rajoitustyyppi?: string
): string {
  if (suuruusKmh != null && suuruusKmh > 0) {
    return `Nopeusrajoitus ${suuruusKmh} km/h`;
  }
  if (suuruusRaw && suuruusRaw.trim().length > 0) {
    return suuruusRaw.trim();
  }
  if (rajoitustyyppi && rajoitustyyppi.trim().length > 0) {
    return rajoitustyyppi.trim();
  }
  return `Merkkityyppi ${vlmlajityyppi}`;
}

/** Unique key for deduplication. Speed types: vlmlajityyppi only (we keep highest). Others: vlmlajityyppi + suuruusRaw. */
function itemKey(vlmlajityyppi: number, suuruusKmh?: number, suuruusRaw?: string): string {
  if (SUURUUS_SUFFIX_TYPES.has(vlmlajityyppi)) return `${vlmlajityyppi}`;
  if (suuruusKmh != null) return `${vlmlajityyppi}:${suuruusKmh}`;
  if (suuruusRaw && suuruusRaw.trim()) return `${vlmlajityyppi}:${suuruusRaw.trim()}`;
  return `${vlmlajityyppi}:`;
}

/**
 * Build fallback display item when rajoitustyypit is empty - use restriction's own fields.
 */
function buildFallbackItem(r: ApplicableRestriction): RestrictionDisplayItem {
  const label =
    r.suuruusKmh != null
      ? `Nopeusrajoitus ${r.suuruusKmh} km/h`
      : r.suuruusRaw?.trim() || r.rajoitustyyppi?.trim() || r.lisatieto?.trim() || r.poikkeus?.trim() || 'Rajoitus';
  return {
    vlmlajityyppi: 0,
    iconKey: 'merkki_default',
    iconUrl: getDefaultIconUrl(),
    label,
    poikkeus: r.poikkeus?.trim() || undefined,
    lisatieto: r.lisatieto?.trim() || undefined,
  };
}

/**
 * Build display items from applicable restrictions.
 * Always uses rajoitustyypit -> RAJOITUSTYYPIT_TO_VLMLAJITYYPPI translation table
 * to determine which sign icons to display.
 * - For speed signs, suuruus holds the limit; when multiple areas overlap, show the higher speed limit.
 * - Deduplicates: same sign type + same value shown once.
 * - poikkeus and lisatieto are included when present.
 * - Fallback: when rajoitustyypit is empty, creates items from rajoitustyyppi/suuruus/lisatieto/poikkeus.
 */
export function getRestrictionDisplayItems(
  restrictions: ApplicableRestriction[]
): RestrictionDisplayItem[] {
  if (restrictions.length === 0) return [];

  const byKey = new Map<string, RestrictionDisplayItem>();

  for (const r of restrictions) {
    let vlmlajityyppit = parseRajoitustyypitToVlmlajityyppi(r.rajoitustyypit);
    if (vlmlajityyppit.length === 0) {
      vlmlajityyppit = parseRajoitustyypitToVlmlajityyppi(r.rajoitustyyppi || '');
    }
    if (vlmlajityyppit.length === 0) {
      const fallback = buildFallbackItem(r);
      const key = `fallback:${r.id}`;
      if (!byKey.has(key)) byKey.set(key, fallback);
      continue;
    }

    for (const vlmlajityyppi of vlmlajityyppit) {
      // Only rajoitustyyppi 01 → vlmlajityyppi 11 (speed limit) uses the suuruus field;
      // all other types must ignore it so they don't inherit speed-related icons/labels.
      const suuruusKmh = vlmlajityyppi === 11 ? r.suuruusKmh : undefined;
      const suuruusRaw = vlmlajityyppi === 11 ? r.suuruusRaw?.trim() : undefined;
      const key = itemKey(vlmlajityyppi, suuruusKmh, suuruusRaw || undefined);

      const existing = byKey.get(key);
      const iconKey = deriveIconKey(vlmlajityyppi, suuruusKmh);
      const newItem: RestrictionDisplayItem = {
        vlmlajityyppi,
        iconKey,
        iconUrl: getIconUrl(iconKey),
        label: buildLabel(vlmlajityyppi, suuruusKmh, r.suuruusRaw, r.rajoitustyyppi),
        poikkeus: r.poikkeus?.trim() || undefined,
        lisatieto: r.lisatieto?.trim() || undefined,
      };

      if (existing) {
        if (SUURUUS_SUFFIX_TYPES.has(vlmlajityyppi) && suuruusKmh != null) {
          const existingMatch = existing.iconKey.match(/_(\d+)$/);
          const existingKmh = existingMatch ? parseInt(existingMatch[1], 10) : undefined;
          if (existingKmh == null || suuruusKmh > existingKmh) {
            byKey.set(key, newItem);
          }
        }
      } else {
        byKey.set(key, newItem);
      }
    }
  }

  let items = Array.from(byKey.values());
  // Put fallback items (vlmlajityyppi 0) at end
  items = items.sort((a, b) => {
    if (a.vlmlajityyppi === 0 && b.vlmlajityyppi !== 0) return 1;
    if (a.vlmlajityyppi !== 0 && b.vlmlajityyppi === 0) return -1;
    const aIsSpeed = SUURUUS_SUFFIX_TYPES.has(a.vlmlajityyppi);
    const bIsSpeed = SUURUUS_SUFFIX_TYPES.has(b.vlmlajityyppi);
    if (aIsSpeed && bIsSpeed) {
      const aMatch = a.iconKey.match(/_(\d+)$/);
      const bMatch = b.iconKey.match(/_(\d+)$/);
      const aVal = aMatch ? parseInt(aMatch[1], 10) : 0;
      const bVal = bMatch ? parseInt(bMatch[1], 10) : 0;
      return bVal - aVal; // higher speed first
    }
    if (aIsSpeed) return -1;
    if (bIsSpeed) return 1;
    return a.vlmlajityyppi - b.vlmlajityyppi;
  });

  return items;
}
