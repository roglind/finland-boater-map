import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from './data/db';
import { DataUpdater } from './data/updater';
import { spatialIndex } from './logic/spatialIndex';
import { getApplicableRestrictions } from './logic/applicability';
import { getNearbySignsWithDistance, getUniqueVlmtyyppi, getSignsInAreas, signsToNearbySigns } from './logic/nearbySigns';
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

// Fallback when GPS is unavailable; use Finland center so signs/restrictions still show
const FALLBACK_POSITION: BoatPosition = { lat: 60.5, lng: 25.0, timestamp: 0 };
// When using fallback/map center, use at least this radius (m) so the search finds signs
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
  const [showSettings, setShowSettings] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [availableVlmtyyppi, setAvailableVlmtyyppi] = useState<number[]>([]);
  
  const updaterRef = useRef<DataUpdater | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastEvalRef = useRef<number>(0);
  const lastPositionRef = useRef<BoatPosition | null>(null);
  const mapCenterRef = useRef<BoatPosition>({ ...FALLBACK_POSITION });
  const mapBoundsRef = useRef<{ sw: { lng: number; lat: number }; ne: { lng: number; lat: number } } | null>(null);
  
  // Initialize updater
  useEffect(() => {
    updaterRef.current = new DataUpdater(setUpdateStatus);
    
    return () => {
      if (updaterRef.current) {
        updaterRef.current.cleanup();
      }
    };
  }, []);
  
  // Load data from IndexedDB on mount
  useEffect(() => {
    loadDataFromDB();
  }, []);
  
    const loadDataFromDB = async () => {
      try {
        const areas = await db.restriction_areas.toArray();
        const signs = await db.traffic_signs.toArray();
        if (areas.length > 0 && signs.length > 0) {
          spatialIndex.buildAreaIndex(areas);
          spatialIndex.buildSignIndex(signs);
          setAvailableVlmtyyppi(getUniqueVlmtyyppi(signs));
          setDataLoaded(true);
          lastEvalRef.current = 0;
          evaluatePosition(lastPositionRef.current ?? FALLBACK_POSITION, { force: true });
        }
      } catch (error) {
        console.error('Failed to load data from IndexedDB:', error);
      }
    };
  
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

  // Start geolocation watch
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
        lastPositionRef.current = newPosition;
        
        // Evaluate restrictions/signs
        evaluatePosition(newPosition);
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
  }, [filters, dataLoaded]);
  
  const evaluatePosition = useCallback((position: BoatPosition, options?: { force?: boolean }) => {
    if (!dataLoaded) return;

    const now = Date.now();
    if (!options?.force) {
      if (now - lastEvalRef.current < 1000) return;
      if (lastPositionRef.current) {
        const lastPos = lastPositionRef.current;
        const latDiff = Math.abs(position.lat - lastPos.lat);
        const lngDiff = Math.abs(position.lng - lastPos.lng);
        const movedMeters = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000;
        if (movedMeters < 10) return;
      }
    }

    lastEvalRef.current = now;
    const candidateAreas = spatialIndex.getCandidateAreas(position.lng, position.lat, 0.1);
    const applicable = getApplicableRestrictions(candidateAreas, position, filters);
    setApplicableRestrictions(applicable);

    const allSigns = spatialIndex.getAllSigns();
    let areasForSigns: RestrictionArea[];
    if (lastPositionRef.current) {
      areasForSigns = applicable;
    } else {
      const bounds = mapBoundsRef.current;
      if (
        bounds != null &&
        typeof bounds.sw?.lng === 'number' &&
        typeof bounds.sw?.lat === 'number' &&
        typeof bounds.ne?.lng === 'number' &&
        typeof bounds.ne?.lat === 'number'
      ) {
        areasForSigns = spatialIndex.getAreasInBbox(
          bounds.sw.lng,
          bounds.sw.lat,
          bounds.ne.lng,
          bounds.ne.lat
        );
      } else {
        areasForSigns = applicable;
      }
    }
    let nearby: NearbySign[];
    if (areasForSigns.length > 0) {
      const signsInAreas = getSignsInAreas(areasForSigns, allSigns);
      nearby = signsToNearbySigns(signsInAreas, position, filters);
    } else {
      const isUsingFallback = !lastPositionRef.current;
      const signRadius = isUsingFallback
        ? Math.max(filters.nearbyRadius, MIN_RADIUS_FOR_FALLBACK_M)
        : filters.nearbyRadius;
      const candidateSigns = spatialIndex.getNearbySignsInRadius(
        position.lng,
        position.lat,
        signRadius
      );
      nearby = getNearbySignsWithDistance(candidateSigns, position, { ...filters, nearbyRadius: signRadius });
    }
    setNearbySigns(nearby.slice(0, 50));
  }, [filters, dataLoaded]);

  // Re-evaluate when filters change so sign-type selection and radius update the map immediately
  useEffect(() => {
    if (!dataLoaded) return;
    const position = lastPositionRef.current ?? mapCenterRef.current;
    evaluatePosition(position, { force: true });
  }, [filters, dataLoaded, evaluatePosition]);

  const handleMapViewportChange = useCallback(
    (lng: number, lat: number, bounds: { sw: { lng: number; lat: number }; ne: { lng: number; lat: number } } | null) => {
      mapCenterRef.current = { lng, lat, timestamp: 0 };
      mapBoundsRef.current = bounds;
      if (!lastPositionRef.current && dataLoaded) {
        evaluatePosition(mapCenterRef.current, { force: true });
      }
    },
    [dataLoaded, evaluatePosition]
  );
  
  const updateFilter = <K extends keyof AppFilters>(key: K, value: AppFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  return (
    <div className="app">
      <MapView
        boatPosition={boatPosition}
        restrictions={applicableRestrictions}
        signs={nearbySigns}
        filters={filters}
        dataLoaded={dataLoaded}
        onMapViewportChange={handleMapViewportChange}
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
