import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from './data/db';
import { DataUpdater } from './data/updater';
import { spatialIndex } from './logic/spatialIndex';
import { getApplicableRestrictions } from './logic/applicability';
import {
  getNearbySignsWithDistance,
  getUniqueVlmtyyppi,
  getSignsInAreas,
  mergeNearbySigns,
  signsToNearbySigns
} from './logic/nearbySigns';
import MapView from './components/MapView';
import BottomSheet from './components/BottomSheet';
import SettingsPanel from './components/SettingsPanel';
import UpdateButton from './components/UpdateButton';
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

  const [filters, setFilters] = useState<AppFilters>({
    ammattiliikenne: true,
    vesiskootteri: true,
    selectedVlmtyyppi: new Set<number>(),
    nearbyRadius: 250
  });
  
  const [boatPosition, setBoatPosition] = useState<BoatPosition | null>(null);
  const [applicableRestrictions, setApplicableRestrictions] = useState<ApplicableRestriction[]>([]);
  const [nearbySigns, setNearbySigns] = useState<NearbySign[]>([]);
  const [signsInRestrictionAreas, setSignsInRestrictionAreas] = useState<NearbySign[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [availableVlmtyyppi, setAvailableVlmtyyppi] = useState<number[]>([]);
  const [allAreas, setAllAreas] = useState<RestrictionArea[]>([]);
  const [mode, setMode] = useState<EvalMode>('gps');
  const [viewport, setViewport] = useState<{ center: BoatPosition; bounds: ViewportBounds | null } | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  
  const updaterRef = useRef<DataUpdater | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastEvaluatedAtRef = useRef<number>(0);
  const lastEvaluatedPositionRef = useRef<BoatPosition | null>(null);
  const boatPositionRef = useRef<BoatPosition | null>(null);
  const markersRenderedRef = useRef<number>(0);
  
  useEffect(() => {
    updaterRef.current = new DataUpdater(setUpdateStatus);
    
    return () => {
      updaterRef.current?.cleanup();
    };
  }, []);
  
  const loadDataFromDB = useCallback(async () => {
    try {
      const areas = await db.restriction_areas.toArray();
      const signs = await db.traffic_signs.toArray();
      spatialIndex.buildAreaIndex(areas);
      spatialIndex.buildSignIndex(signs);
      setAllAreas(areas);
      setAvailableVlmtyyppi(getUniqueVlmtyyppi(signs));
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
    const effectiveMode: EvalMode = mode === 'gps' && boatPosition ? 'gps' : 'viewport';
    const position =
      effectiveMode === 'gps'
        ? boatPosition!
        : viewport?.center ?? boatPosition ?? FALLBACK_POSITION;

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

    const allSigns = spatialIndex.getAllSigns();
    const areaSource =
      effectiveMode === 'gps'
        ? applicable
        : viewport?.bounds
          ? spatialIndex.getAreasInBbox(
              viewport.bounds.sw.lng,
              viewport.bounds.sw.lat,
              viewport.bounds.ne.lng,
              viewport.bounds.ne.lat
            )
          : [];

    const areaNearby = signsToNearbySigns(getSignsInAreas(areaSource, allSigns), position, filters);
    const radius = effectiveMode === 'gps'
      ? filters.nearbyRadius
      : Math.max(filters.nearbyRadius, MIN_RADIUS_FOR_FALLBACK_M);
    const radiusNearby = getNearbySignsWithDistance(
      spatialIndex.getNearbySignsInRadius(position.lng, position.lat, radius),
      position,
      { ...filters, nearbyRadius: radius }
    );

    const merged = mergeNearbySigns(areaNearby, radiusNearby).slice(0, 50);
    setNearbySigns(merged);
    setSignsInRestrictionAreas(areaNearby);

    if (import.meta.env.DEV) {
      console.debug('[recompute]', {
        mode: effectiveMode,
        indexedAreas: spatialIndex.getAllAreas().length,
        indexedSigns: allSigns.length,
        candidateAreas: candidateAreas.length,
        applicableAreas: applicable.length,
        areaSigns: areaNearby.length,
        radiusSigns: radiusNearby.length,
        mergedSigns: merged.length,
        markersRendered: markersRenderedRef.current
      });
    }
  }, [dataLoaded, dataVersion, filters, mode, boatPosition, viewport]);
  
  const updateFilter = <K extends keyof AppFilters>(key: K, value: AppFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
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
        <UpdateButton 
          onUpdate={handleUpdate}
          status={updateStatus}
        />
        
        <button 
          className="settings-btn"
          onClick={() => setShowSettings(!showSettings)}
          aria-label="Asetukset"
        >
          ⚙️
        </button>
      </div>
      
      <BottomSheet 
        restrictions={applicableRestrictions}
        signs={nearbySigns}
        signsInRestrictionAreas={signsInRestrictionAreas}
      />
      
      {showSettings && (
        <SettingsPanel
          filters={filters}
          availableVlmtyyppi={availableVlmtyyppi}
          onFilterChange={updateFilter}
          onClose={() => setShowSettings(false)}
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
