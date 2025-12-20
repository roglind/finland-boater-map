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
      this.areaMap.set(area.id, area);
      nodes.push({
        minX: area.bbox[0],
        minY: area.bbox[1],
        maxX: area.bbox[2],
        maxY: area.bbox[3],
        id: area.id
      });
    }
    
    this.areaIndex.clear();
    this.areaIndex.load(nodes);
  }
  
  buildSignIndex(signs: TrafficSign[]): void {
    this.signMap.clear();
    const nodes: SpatialIndexNode[] = [];
    
    for (const sign of signs) {
      this.signMap.set(sign.id, sign);
      const [lng, lat] = sign.geometry.coordinates;
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
