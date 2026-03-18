import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from './data/db';
import { DataUpdater } from './data/updater';
import { spatialIndex } from './logic/spatialIndex';
import { getApplicableRestrictions } from './logic/applicability';
import {
  getNearbySignsWithDistance,
  mergeNearbySigns,
  signsToNearbySigns
} from './logic/nearbySigns';
import { getRestrictionDisplayItems, type RestrictionDisplayItem } from './logic/restrictionDisplay';
import MapView from './components/MapView';
import BottomSheet from './components/BottomSheet';
import SettingsPanel from './components/SettingsPanel';
import type { 
  UpdateStatus, 
  AppFilters, 
  BoatPosition,
  ApplicableRestriction,
  NearbySign,
  RestrictionArea
} from './types';
import './App.css';

type EvalMode = 'gps' | 'viewport';
type ViewportBounds = { sw: { lng: number; lat: number }; ne: { lng: number; lat: number } };

const FALLBACK_POSITION: BoatPosition = { lat: 60.5, lng: 25.0, timestamp: 0 };
const MIN_RADIUS_FOR_FALLBACK_M = 15000;

function App() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    isUpdating: false,
    progress: 0,
    message: ''
  });

  const [filters, setFilters] = useState<AppFilters>(() => {
    try {
      const saved = localStorage.getItem('appFilters');
      if (saved) return { lisatietoja: true, vesiskootteri: true, nearbyRadius: 250, ...JSON.parse(saved) };
    } catch { /* ignore parse errors */ }
    return { lisatietoja: true, vesiskootteri: true, nearbyRadius: 250 };
  });
  
  const [boatPosition, setBoatPosition] = useState<BoatPosition | null>(null);
  const [applicableRestrictions, setApplicableRestrictions] = useState<ApplicableRestriction[]>([]);
  const [nearbySigns, setNearbySigns] = useState<NearbySign[]>([]);
  const [restrictionDisplayItems, setRestrictionDisplayItems] = useState<RestrictionDisplayItem[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [allAreas, setAllAreas] = useState<RestrictionArea[]>([]);
  const [mode, setMode] = useState<EvalMode>('gps');
  const [viewport, setViewport] = useState<{ center: BoatPosition; bounds: ViewportBounds | null } | null>(null);
  const [debouncedViewport, setDebouncedViewport] = useState<{ center: BoatPosition; bounds: ViewportBounds | null } | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  
  const updaterRef = useRef<DataUpdater | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastEvaluatedAtRef = useRef<number>(0);
  const lastEvaluatedPositionRef = useRef<BoatPosition | null>(null);
  const boatPositionRef = useRef<BoatPosition | null>(null);
  const markersRenderedRef = useRef<number>(0);
  const viewportDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    updaterRef.current = new DataUpdater(setUpdateStatus);
    
    return () => {
      updaterRef.current?.cleanup();
    };
  }, []);

  useEffect(() => {
    if (viewportDebounceRef.current) clearTimeout(viewportDebounceRef.current);
    viewportDebounceRef.current = setTimeout(() => setDebouncedViewport(viewport), 150);
    return () => { if (viewportDebounceRef.current) clearTimeout(viewportDebounceRef.current); };
  }, [viewport]);
  
  const loadDataFromDB = useCallback(async () => {
    try {
      const areas = await db.restriction_areas.toArray();
      const signs = await db.traffic_signs.toArray();
      spatialIndex.buildAreaIndex(areas);
      spatialIndex.buildSignIndex(signs);
      setAllAreas(areas);
      setDataLoaded(areas.length > 0 && signs.length > 0);
      setDataVersion(v => v + 1);
      lastEvaluatedAtRef.current = 0;
      lastEvaluatedPositionRef.current = null;
    } catch (error) {
      console.error('Failed to load data from IndexedDB:', error);
    }
  }, []);

  useEffect(() => {
    loadDataFromDB();
  }, [loadDataFromDB]);

  const handleUpdate = async () => {
    try {
      await updaterRef.current?.updateData();
      await loadDataFromDB();
      alert('Päivitys valmis! Ladattu ' + (await db.restriction_areas.count()) + ' rajoitusaluetta ja ' + (await db.traffic_signs.count()) + ' merkkiä.');
    } catch (error) {
      console.error('Update failed:', error);
      alert('Päivitys epäonnistui: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      return;
    }
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPosition: BoatPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading ?? undefined,
          speed: position.coords.speed ?? undefined,
          timestamp: position.timestamp
        };
        
        setBoatPosition(newPosition);
        boatPositionRef.current = newPosition;
      },
      (error) => {
        console.error('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000
      }
    );
    
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const handleMapViewportChange = useCallback((lng: number, lat: number, bounds: ViewportBounds | null) => {
    setViewport({ center: { lng, lat, timestamp: Date.now() }, bounds });
  }, []);

  const handleMapDragStart = useCallback(() => {
    setMode('viewport');
  }, []);

  const handleRecenterRequest = useCallback(() => {
    if (boatPositionRef.current) {
      setMode('gps');
    }
  }, []);

  const handleMarkersRendered = useCallback((count: number) => {
    markersRenderedRef.current = count;
  }, []);

  useEffect(() => {
    if (!dataLoaded) return;
    try {
      const effectiveMode: EvalMode = mode === 'gps' && boatPosition ? 'gps' : 'viewport';
      const position =
        effectiveMode === 'gps'
          ? boatPosition!
          : debouncedViewport?.center ?? boatPosition ?? FALLBACK_POSITION;

      const now = Date.now();
      if (effectiveMode === 'gps') {
        if (now - lastEvaluatedAtRef.current < 1000) return;
        if (lastEvaluatedPositionRef.current) {
          const lastPos = lastEvaluatedPositionRef.current;
          const latDiff = Math.abs(position.lat - lastPos.lat);
          const lngDiff = Math.abs(position.lng - lastPos.lng);
          const movedMeters = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000;
          if (movedMeters < 10) return;
        }
      }

      lastEvaluatedAtRef.current = now;
      lastEvaluatedPositionRef.current = position;

      const candidateAreas = spatialIndex.getCandidateAreas(position.lng, position.lat, 0.1);
      const applicable = getApplicableRestrictions(candidateAreas, position, filters);
      setApplicableRestrictions(applicable);

      const areaSource =
        effectiveMode === 'gps'
          ? applicable
          : debouncedViewport?.bounds
            ? spatialIndex.getAreasInBbox(
                debouncedViewport.bounds.sw.lng,
                debouncedViewport.bounds.sw.lat,
                debouncedViewport.bounds.ne.lng,
                debouncedViewport.bounds.ne.lat
              )
            : [];

      const areaNearby = signsToNearbySigns(spatialIndex.getSignsInAreas(areaSource), position, filters);
      const radius = effectiveMode === 'gps'
        ? filters.nearbyRadius
        : Math.max(filters.nearbyRadius, MIN_RADIUS_FOR_FALLBACK_M);
      const radiusNearby = getNearbySignsWithDistance(
        spatialIndex.getNearbySignsInRadius(position.lng, position.lat, radius),
        position,
        { ...filters, nearbyRadius: radius }
      );

      const merged = mergeNearbySigns(areaNearby, radiusNearby)
        .slice(0, 50);
      setNearbySigns(merged);
      setRestrictionDisplayItems(getRestrictionDisplayItems(applicable));

      if (import.meta.env.DEV) {
        console.debug('[recompute]', {
          mode: effectiveMode,
          indexedAreas: spatialIndex.getAllAreas().length,
          candidateAreas: candidateAreas.length,
          applicableAreas: applicable.length,
          areaSigns: areaNearby.length,
          radiusSigns: radiusNearby.length,
          mergedSigns: merged.length,
          markersRendered: markersRenderedRef.current
        });
      }
    } catch (err) {
      console.error('Position evaluation error:', err);
    }
  }, [dataLoaded, dataVersion, filters, mode, boatPosition, debouncedViewport]);
  
  const updateFilter = <K extends keyof AppFilters>(key: K, value: AppFilters[K]) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem('appFilters', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  
  return (
    <div className="app">
      <MapView
        boatPosition={boatPosition}
        restrictionAreas={allAreas}
        signs={nearbySigns}
        filters={filters}
        mode={mode}
        onRequestGpsMode={handleRecenterRequest}
        onMapViewportChange={handleMapViewportChange}
        onMapDragStart={handleMapDragStart}
        onMarkersRendered={handleMarkersRendered}
      />
      
      <div className="controls">
        <button 
          className="settings-btn"
          onClick={() => setShowSettings(!showSettings)}
          aria-label="Asetukset"
        >
          ⚙️
        </button>
      </div>
      
      <div className="speed-overlay">
        {boatPosition?.speed != null
          ? `${(boatPosition.speed * 3.6).toFixed(1)} km/h`
          : '– km/h'}
      </div>

      <BottomSheet 
        restrictions={applicableRestrictions}
        signs={nearbySigns}
        restrictionDisplayItems={restrictionDisplayItems}
        filters={filters}
      />
      
      {showSettings && (
        <SettingsPanel
          filters={filters}
          onFilterChange={updateFilter}
          onClose={() => setShowSettings(false)}
          onUpdate={handleUpdate}
          updateStatus={updateStatus}
        />
      )}
      
      {updateStatus.error && (
        <div className="error-toast">
          {updateStatus.error}
        </div>
      )}
    </div>
  );
}

export default App;
