import RBush from 'rbush';
import type { RestrictionArea, TrafficSign, SpatialIndexNode, BBox } from '../types';

export class SpatialIndex {
  private areaIndex: RBush<SpatialIndexNode>;
  private signIndex: RBush<SpatialIndexNode>;
  private areaMap: Map<number, RestrictionArea>;
  private signMap: Map<number, TrafficSign>;
  
  constructor() {
    this.areaIndex = new RBush<SpatialIndexNode>();
    this.signIndex = new RBush<SpatialIndexNode>();
    this.areaMap = new Map();
    this.signMap = new Map();
  }
  
  buildAreaIndex(areas: RestrictionArea[]): void {
    this.areaMap.clear();
    const nodes: SpatialIndexNode[] = [];
    
    for (const area of areas) {
      const [minX, minY, maxX, maxY] = area.bbox ?? [];
      if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        continue;
      }
      this.areaMap.set(area.id, area);
      nodes.push({ minX, minY, maxX, maxY, id: area.id });
    }
    
    this.areaIndex.clear();
    this.areaIndex.load(nodes);
  }
  
  /** Normalize to [lng, lat] for Finland; some data is stored as (lat, lng). */
  private static signCoordsLngLat(coord: number[]): [number, number] {
    if (coord.length !== 2) return [coord[0], coord[1]];
    const [a, b] = coord;
    if (a >= 55 && a <= 75 && b >= 18 && b <= 32) return [b, a];
    return [a, b];
  }

  private static isValidLngLat(lng: number, lat: number): boolean {
    return Number.isFinite(lng) && Number.isFinite(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
  }

  buildSignIndex(signs: TrafficSign[]): void {
    this.signMap.clear();
    const nodes: SpatialIndexNode[] = [];

    for (const sign of signs) {
      const [lng, lat] = SpatialIndex.signCoordsLngLat(sign.geometry.coordinates);
      if (!SpatialIndex.isValidLngLat(lng, lat)) continue;
      if (sign.geometry.coordinates[0] !== lng || sign.geometry.coordinates[1] !== lat) {
        (sign.geometry as { coordinates: number[] }).coordinates = [lng, lat];
      }
      this.signMap.set(sign.id, sign);
      nodes.push({
        minX: lng,
        minY: lat,
        maxX: lng,
        maxY: lat,
        id: sign.id
      });
    }

    this.signIndex.clear();
    this.signIndex.load(nodes);
  }
  
  getCandidateAreas(lng: number, lat: number, buffer: number = 0.01): RestrictionArea[] {
    const results = this.areaIndex.search({
      minX: lng - buffer,
      minY: lat - buffer,
      maxX: lng + buffer,
      maxY: lat + buffer
    });
    return results
      .map(node => this.areaMap.get(node.id))
      .filter((area): area is RestrictionArea => area != null);
  }

  /** Areas whose bbox overlaps the given bbox (for viewport-based sign lookup). */
  getAreasInBbox(minLng: number, minLat: number, maxLng: number, maxLat: number): RestrictionArea[] {
    const results = this.areaIndex.search({
      minX: minLng,
      minY: minLat,
      maxX: maxLng,
      maxY: maxLat
    });
    return results
      .map(node => this.areaMap.get(node.id))
      .filter((area): area is RestrictionArea => area != null);
  }
  
  getNearbySignsInRadius(lng: number, lat: number, radiusMeters: number): TrafficSign[] {
    // Approximate: 1 degree ≈ 111km at equator
    // For Finland (≈60°N), 1 degree longitude ≈ 55km
    const latBuffer = radiusMeters / 111000;
    const lngBuffer = radiusMeters / 55000;
    
    const results = this.signIndex.search({
      minX: lng - lngBuffer,
      minY: lat - latBuffer,
      maxX: lng + lngBuffer,
      maxY: lat + latBuffer
    });
    
    return results
      .map(node => this.signMap.get(node.id))
      .filter((sign): sign is TrafficSign => sign != null);
  }
  
  getAllAreas(): RestrictionArea[] {
    return Array.from(this.areaMap.values());
  }
  
  getAllSigns(): TrafficSign[] {
    return Array.from(this.signMap.values());
  }
}

export const spatialIndex = new SpatialIndex();
