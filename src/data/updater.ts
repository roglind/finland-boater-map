import { db, setLastUpdated, getMeta, setMeta } from './db';
import type { RestrictionArea, TrafficSign, UpdateStatus } from '../types';

const RAJOITUS_URL = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://aineistot.vayla.fi/?path=ava/Vesi/Paikkatieto/Uusi_tietosisalto/rajoitusalue_a.gpkg');
const VESILIIKENNE_URL = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://aineistot.vayla.fi/?path=ava/Vesi/Paikkatieto/Uusi_tietosisalto/vesiliikennemerkit.gpkg');
export class DataUpdater {
  private worker: Worker | null = null;
  private onStatusChange: (status: UpdateStatus) => void;
  
  constructor(onStatusChange: (status: UpdateStatus) => void) {
    this.onStatusChange = onStatusChange;
  }
  
  private updateStatus(partial: Partial<UpdateStatus>) {
    this.onStatusChange({
      isUpdating: false,
      progress: 0,
      message: '',
      ...partial
    });
  }
  
  async updateData(): Promise<void> {
    this.updateStatus({ isUpdating: true, progress: 0, message: 'Aloitetaan päivitys...' });
    
    try {
      // Fetch both files in parallel
      this.updateStatus({ progress: 10, message: 'Ladataan rajoitusalueet...' });
      const rajoitusPromise = this.fetchFile(RAJOITUS_URL, 'rajoitus');
      
      this.updateStatus({ progress: 30, message: 'Ladataan liikennemerkit...' });
      const vesiliikennePromise = this.fetchFile(VESILIIKENNE_URL, 'vesiliikenne');
      
      const [rajoitusBuffer, vesiliikenneBuffer] = await Promise.all([
        rajoitusPromise,
        vesiliikennePromise
      ]);
      
      // Parse restriction areas
      this.updateStatus({ progress: 50, message: 'Käsitellään rajoitusalueet...' });
      const restrictionAreas = await this.parseInWorker(rajoitusBuffer, 'rajoitus') as RestrictionArea[];
      
      // Parse traffic signs
      this.updateStatus({ progress: 70, message: 'Käsitellään liikennemerkit...' });
      const trafficSigns = await this.parseInWorker(vesiliikenneBuffer, 'vesiliikenne') as TrafficSign[];
      
      // Store to IndexedDB
      this.updateStatus({ progress: 85, message: 'Tallennetaan tietokantaan...' });
      await this.storeData(restrictionAreas, trafficSigns);
      
      // Update timestamps
      const now = new Date().toISOString();
      await setLastUpdated('rajoitus', now);
      await setLastUpdated('vesiliikenne', now);
      
      this.updateStatus({ 
        isUpdating: false, 
        progress: 100, 
        message: 'Päivitys valmis!' 
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        this.updateStatus({ progress: 0, message: '' });
      }, 3000);
      
    } catch (error) {
      console.error('Update failed:', error);
      this.updateStatus({
        isUpdating: false,
        progress: 0,
        message: '',
        error: error instanceof Error ? error.message : 'Päivitys epäonnistui'
      });
    }
  }
  
  private async fetchFile(url: string, type: 'rajoitus' | 'vesiliikenne'): Promise<ArrayBuffer> {
    const etag = await getMeta(`${type}_etag`);
    
    const headers: HeadersInit = {};
    if (etag) {
      headers['If-None-Match'] = etag;
    }
    
    const response = await fetch(url, { headers });
    
    if (response.status === 304) {
      // Not modified, return empty buffer (will skip parsing)
      throw new Error('Data not modified');
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Store new ETag
    const newEtag = response.headers.get('ETag');
    if (newEtag) {
      await setMeta(`${type}_etag`, newEtag);
    }
    
    return await response.arrayBuffer();
  }
  
  private async parseInWorker(
    arrayBuffer: ArrayBuffer, 
    dataType: 'rajoitus' | 'vesiliikenne'
  ): Promise<RestrictionArea[] | TrafficSign[]> {
    return new Promise((resolve, reject) => {
      // Create worker if not exists
      if (!this.worker) {
        this.worker = new Worker(
          new URL('./parseGpkg.worker.ts', import.meta.url),
          { type: 'module' }
        );
      }
      
      const handleMessage = (e: MessageEvent) => {
        if (e.data.type === 'result') {
          this.worker?.removeEventListener('message', handleMessage);
          resolve(e.data.data);
        } else if (e.data.type === 'error') {
          this.worker?.removeEventListener('message', handleMessage);
          reject(new Error(e.data.error));
        }
      };
      
      this.worker.addEventListener('message', handleMessage);
      this.worker.postMessage({ type: 'parse', dataType, arrayBuffer });
    });
  }
  
  private async storeData(restrictionAreas: RestrictionArea[], trafficSigns: TrafficSign[]): Promise<void> {
    await db.transaction('rw', [db.restriction_areas, db.traffic_signs], async () => {
      // Clear existing data
      await db.restriction_areas.clear();
      await db.traffic_signs.clear();
      
      // Bulk insert new data
      await db.restriction_areas.bulkAdd(restrictionAreas);
      await db.traffic_signs.bulkAdd(trafficSigns);
    });
  }
  
  cleanup() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
