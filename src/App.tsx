// Add console stuff
import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from './data/db';
import { DataUpdater } from './data/updater';
import { spatialIndex } from './logic/spatialIndex';
import { getApplicableRestrictions } from './logic/applicability';
import { getNearbySignsWithDistance, getUniqueVlmtyyppi } from './logic/nearbySigns';
import MapView from './components/MapView';
import BottomSheet from './components/BottomSheet';
import SettingsPanel from './components/SettingsPanel';
import UpdateButton from './components/UpdateButton';
import type { 
  UpdateStatus, 
  AppFilters, 
  BoatPosition,
  ApplicableRestriction,
  NearbySign
} from './types';
import './App.css';

function App() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    isUpdating: false,
    progress: 0,
    message: ''
  });

  useEffect(() => {
    if (!updaterRef.current) {
      updaterRef.current = new DataUpdater(setUpdateStatus);
    }
  
    return () => {
      updaterRef.current?.cleanup();
    };
  }, []);

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
        console.log('Loading data from IndexedDB...');
        const areas = await db.restriction_areas.toArray();
        const signs = await db.traffic_signs.toArray();
        console.log('Loaded from DB:', { areas: areas.length, signs: signs.length });
    
        if (areas.length > 0 && signs.length > 0) {
          console.log('Building spatial indexes...');
          spatialIndex.buildAreaIndex(areas);
          spatialIndex.buildSignIndex(signs);
          setAvailableVlmtyyppi(getUniqueVlmtyyppi(signs));
          setDataLoaded(true);
          // Force immediate evaluation if we have a position
          if (lastPositionRef.current) {
            console.log('🔄 Forcing initial evaluation with current position');
            // Reset last eval time to force evaluation
            lastEvalRef.current = 0;
            evaluatePosition(lastPositionRef.current);
          }
          console.log('Data loaded and indexed successfully!');
        } else {
          console.log('No data in IndexedDB yet');
        }
      } catch (error) {
        console.error('Failed to load data from IndexedDB:', error);
      }
    };
  
    const handleUpdate = async () => {
      console.log('=== UPDATE STARTED ===');
      try {
        console.log('Calling updater.updateData()...');
        await updaterRef.current?.updateData();
        console.log('=== UPDATE COMPLETED SUCCESSFULLY ===');
    
        // Reload data from IndexedDB
        console.log('Reloading data from IndexedDB...');
        await loadDataFromDB();
        console.log('Data reloaded!');
    
        alert('Päivitys valmis! Ladattu ' + (await db.restriction_areas.count()) + ' rajoitusaluetta ja ' + (await db.traffic_signs.count()) + ' merkkiä.');
      } catch (error) {
        console.error('=== UPDATE FAILED ===');
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
  
  const evaluatePosition = useCallback((position: BoatPosition) => {
    console.log('🎯 evaluatePosition called:', {
      lat: position.lat,
      lng: position.lng,
      dataLoaded: dataLoaded
    });
  
    if (!dataLoaded) {
      console.log('⚠️ Data not loaded yet, skipping evaluation');
      return;
    }
  
    const now = Date.now();
    const timeSinceLastEval = now - lastEvalRef.current;
  
    // Throttle evaluation to once per second
    if (timeSinceLastEval < 1000) {
      console.log('⏱️ Throttled (too soon)');
      return;
    }
  
    // Check if moved more than 10m
    // TEMPORARILY DISABLED - for testing
    /*
    if (lastPositionRef.current) {
      const lastPos = lastPositionRef.current;
      const latDiff = Math.abs(position.lat - lastPos.lat);
      const lngDiff = Math.abs(position.lng - lastPos.lng);
      const movedMeters = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000;
    
      if (movedMeters < 10) {
        console.log('📍 Haven\'t moved enough:', movedMeters.toFixed(2), 'm');
        return;
      }
    }
    */
  
    lastEvalRef.current = now;
    console.log('✅ Evaluating...');
  
    // Get candidate areas from spatial index
    const candidateAreas = spatialIndex.getCandidateAreas(position.lng, position.lat, 0.05);
    console.log('📦 Candidate areas from spatial index:', candidateAreas.length);
  
    // Filter to applicable restrictions
    const applicable = getApplicableRestrictions(candidateAreas, position, filters);
    console.log('✓ Applicable restrictions:', applicable.length);
    setApplicableRestrictions(applicable);
  
    // Get nearby signs
    const candidateSigns = spatialIndex.getNearbySignsInRadius(
      position.lng, 
      position.lat, 
      filters.nearbyRadius
    );
    console.log('🚩 Candidate signs:', candidateSigns.length);
  
    const nearby = getNearbySignsWithDistance(candidateSigns, position, filters);
    console.log('✓ Nearby signs after filtering:', nearby.length);
    setNearbySigns(nearby.slice(0, 10));
  
  }, [filters, dataLoaded]);
  
  const updateFilter = <K extends keyof AppFilters>(key: K, value: AppFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  return (
    <div className="app">
      <MapView 
        boatPosition={boatPosition}
        restrictions={applicableRestrictions}
        signs={nearbySigns}
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
