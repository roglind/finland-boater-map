//Fix path
import Dexie, { Table } from 'dexie';
import type { RestrictionArea, TrafficSign } from '../types';

export interface MetaEntry {
  key: string;
  value: any;
}

export class BoaterMapDB extends Dexie {
  meta!: Table<MetaEntry, string>;
  restriction_areas!: Table<RestrictionArea, number>;
  traffic_signs!: Table<TrafficSign, number>;

  constructor() {
    super('boater_map_db');
    
    this.version(1).stores({
      meta: 'key',
      restriction_areas: 'id, bbox',
      traffic_signs: 'id, vlmtyyppi'
    });
  }
}

export const db = new BoaterMapDB();

// Helper functions for meta storage
export const getMeta = async (key: string): Promise<any> => {
  const entry = await db.meta.get(key);
  return entry?.value;
};

export const setMeta = async (key: string, value: any): Promise<void> => {
  await db.meta.put({ key, value });
};

export const getLastUpdated = async (dataType: 'rajoitus' | 'vesiliikenne'): Promise<string | null> => {
  return await getMeta(`${dataType}_lastUpdated`);
};

export const setLastUpdated = async (dataType: 'rajoitus' | 'vesiliikenne', timestamp: string): Promise<void> => {
  await setMeta(`${dataType}_lastUpdated`, timestamp);
};