import { db, setLastUpdated, getMeta, getParserVersion, setParserVersion, setMeta } from './db';
import type { RestrictionArea, TrafficSign, UpdateStatus } from '../types';

const RAJOITUS_URL = '/finland-boater-map/data/rajoitusalue_a.gpkg';
const VESILIIKENNE_URL = '/finland-boater-map/data/vesiliikennemerkit.gpkg';
const PARSER_VERSION = '2026-03-05-suuruus-iconkey-v1';
const SUURUUS_SUFFIX_TYPES = new Set([11, 15, 16, 17, 19]);

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
      const storedParserVersion = await getParserVersion();
      const parserVersionChanged = storedParserVersion !== PARSER_VERSION;

      // Fetch files sequentially so progress is linear and easy to follow
      // Rajoitus: 5 → 50%
      this.updateStatus({
        isUpdating: true,
        progress: 5,
        message: parserVersionChanged
          ? 'Parseri päivittynyt, ladataan aineistot uudelleen...'
          : 'Ladataan rajoitusalueet...'
      });
      const rajoitusBuffer = await this.fetchFileStreaming(
        RAJOITUS_URL, 'rajoitus', parserVersionChanged,
        (loaded, total) => {
          this.updateStatus({
            isUpdating: true,
            progress: 5 + Math.round((loaded / total) * 45),
            message: 'Ladataan rajoitusalueet...'
          });
        }
      );

      // Vesiliikenne: 50 → 75%
      this.updateStatus({ isUpdating: true, progress: 50, message: 'Ladataan liikennemerkit...' });
      const vesiliikenneBuffer = await this.fetchFileStreaming(
        VESILIIKENNE_URL, 'vesiliikenne', parserVersionChanged,
        (loaded, total) => {
          this.updateStatus({
            isUpdating: true,
            progress: 50 + Math.round((loaded / total) * 25),
            message: 'Ladataan liikennemerkit...'
          });
        }
      );

      if (parserVersionChanged && (!rajoitusBuffer || !vesiliikenneBuffer)) {
        throw new Error('Parseri paivittyi, mutta aineistoa ei voitu hakea uudelleen kokonaan.');
      }

      // If neither dataset changed and parser did not change, we're done
      if (!rajoitusBuffer && !vesiliikenneBuffer && !parserVersionChanged) {
        this.updateStatus({ 
          isUpdating: false, 
          progress: 100, 
          message: 'Data jo ajan tasalla!' 
        });
        setTimeout(() => {
          this.updateStatus({ progress: 0, message: '' });
        }, 3000);
       return;
      }

      let restrictionAreas: RestrictionArea[] | null = null;
      let trafficSigns: TrafficSign[] | null = null;

      if (rajoitusBuffer) {
        this.updateStatus({ isUpdating: true, progress: 75, message: 'Käsitellään rajoitusalueet...' });
        restrictionAreas = await this.parseInWorker(rajoitusBuffer, 'rajoitus') as RestrictionArea[];
      }

      if (vesiliikenneBuffer) {
        this.updateStatus({ isUpdating: true, progress: 82, message: 'Käsitellään liikennemerkit...' });
        trafficSigns = await this.parseInWorker(vesiliikenneBuffer, 'vesiliikenne') as TrafficSign[];
        this.logIconKeySuffixSamples(trafficSigns);
      }

      this.updateStatus({ isUpdating: true, progress: 90, message: 'Tallennetaan tietokantaan...' });
      if (restrictionAreas) {
        await this.storeRestrictionAreas(restrictionAreas);
      }
      if (trafficSigns) {
        await this.storeTrafficSigns(trafficSigns);
      }

      // Update timestamps
      const now = new Date().toISOString();
      if (restrictionAreas) {
        await setLastUpdated('rajoitus', now);
      }
      if (trafficSigns) {
        await setLastUpdated('vesiliikenne', now);
      }
      await setParserVersion(PARSER_VERSION);

      const restrictionCount = restrictionAreas
        ? restrictionAreas.length
        : await db.restriction_areas.count();
      const signCount = trafficSigns
        ? trafficSigns.length
        : await db.traffic_signs.count();
      
      this.updateStatus({ 
        isUpdating: false, 
        progress: 100, 
        message: `Päivitys valmis! ${restrictionCount} rajoitusaluetta ja ${signCount} merkkiä`
      });
      
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
  
  private async fetchFileStreaming(
    url: string,
    type: 'rajoitus' | 'vesiliikenne',
    forceRefresh: boolean,
    onProgress: (loaded: number, total: number) => void
  ): Promise<ArrayBuffer | null> {
    const etag = await getMeta(`${type}_etag`);

    const headers: HeadersInit = {};
    if (etag && !forceRefresh) {
      headers['If-None-Match'] = etag;
    }

    const requestUrl = forceRefresh
      ? `${url}${url.includes('?') ? '&' : '?'}parser_version=${encodeURIComponent(PARSER_VERSION)}`
      : url;

    const response = await fetch(requestUrl, {
      headers,
      cache: forceRefresh ? 'no-store' : 'default'
    });

    if (response.status === 304) return null;

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Store new ETag
    const newEtag = response.headers.get('ETag');
    if (newEtag) {
      await setMeta(`${type}_etag`, newEtag);
    }

    // Fall back to known approximate sizes if Content-Length is absent (e.g. gzip transfer)
    const FALLBACK_SIZES: Record<string, number> = { rajoitus: 10_000_000, vesiliikenne: 4_000_000 };
    const contentLength = response.headers.get('Content-Length');
    const total = contentLength ? parseInt(contentLength, 10) : FALLBACK_SIZES[type];

    if (!response.body) {
      // Streams API unavailable — fall back to arrayBuffer without progress
      const buffer = await response.arrayBuffer();
      onProgress(buffer.byteLength, buffer.byteLength);
      return buffer;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      onProgress(loaded, total);
    }

    const result = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result.buffer;
  }
  
  private async parseInWorker(
    arrayBuffer: ArrayBuffer, 
    dataType: 'rajoitus' | 'vesiliikenne'
  ): Promise<RestrictionArea[] | TrafficSign[]> {
    return new Promise((resolve, reject) => {
      // Create worker if not exists
      if (!this.worker) {
        this.worker = new Worker(
          new URL('./gpkgParser.worker.ts', import.meta.url),
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
  
  private async storeRestrictionAreas(restrictionAreas: RestrictionArea[]): Promise<void> {
    await db.transaction('rw', [db.restriction_areas], async () => {
      await db.restriction_areas.clear();
      await db.restriction_areas.bulkAdd(restrictionAreas);
    });
  }

  private async storeTrafficSigns(trafficSigns: TrafficSign[]): Promise<void> {
    await db.transaction('rw', [db.traffic_signs], async () => {
      await db.traffic_signs.clear();
      await db.traffic_signs.bulkAdd(trafficSigns);
    });
  }

  private logIconKeySuffixSamples(trafficSigns: TrafficSign[]): void {
    const withSuffix = trafficSigns
      .filter((sign) => SUURUUS_SUFFIX_TYPES.has(sign.vlmlajityyppi) && /_\d+$/.test(sign.iconKey))
      .slice(0, 8)
      .map((sign) => sign.iconKey);
    if (withSuffix.length > 0) {
      console.info('[DataUpdater] SUURUUS iconKey samples:', withSuffix);
    }
  }
  
  cleanup() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
