// MapView with filter-responsive area display
import { db } from '../data/db';
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { BoatPosition, ApplicableRestriction, NearbySign, AppFilters } from '../types';
import './MapView.css';

interface MapViewProps {
  boatPosition: BoatPosition | null;
  restrictions: ApplicableRestriction[];
  signs: NearbySign[];
  filters: AppFilters;
}

function MapView({ boatPosition, restrictions, signs, filters }: MapViewProps) {
  console.log('🗺️ MapView render:', {
    position: boatPosition,
    restrictionsCount: restrictions.length,
    signsCount: signs.length
  });

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const signMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [isFollowingGPS, setIsFollowingGPS] = useState(true);
  const [areasDisplayed, setAreasDisplayed] = useState(false);

  // Initialize map (once)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: [25.0, 60.5],
      zoom: 8,
      attributionControl: true
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    mapRef.current = map;

    // Wait for map to load, then add areas
    map.on('load', () => {
      console.log('🗺️ Map loaded event');
      loadAndDisplayAreas();
    });

    return () => {
      signMarkersRef.current.forEach(m => m.remove());
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load areas once when map is ready
  const loadAndDisplayAreas = async () => {
    if (!mapRef.current) return;
    
    const map = mapRef.current;
    console.log('🟢 Loading all areas...');

    try {
      const allAreas = await db.restriction_areas.toArray();
      console.log('🟢 Loaded', allAreas.length, 'areas from DB');

      if (allAreas.length === 0) {
        console.log('🟢 No areas to display');
        return;
      }

      // Validate geometries
      const validAreas = allAreas.filter(r => {
        if (!r.geometry || !r.geometry.coordinates) return false;
        
        const checkCoords = (coords: any): boolean => {
          if (Array.isArray(coords)) {
            if (coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
              return isFinite(coords[0]) && isFinite(coords[1]) && coords[0] !== 0 && coords[1] !== 0;
            }
            return coords.every(c => checkCoords(c));
          }
          return false;
        };
        
        return checkCoords(r.geometry.coordinates);
      });

      console.log('🟢 Valid areas:', validAreas.length);

      // Create GeoJSON features with filter properties
      const features = validAreas.map(r => {
        const isSpeedLimit = r.suuruusKmh != null;
        const isAmmattiliikenne = r.lisatieto?.toLowerCase().includes('ammatti') || false;
        const isVesiskootteri = r.rajoitustyyppi?.toLowerCase().includes('vesiskootteri') || 
                               r.rajoitustyypit?.toLowerCase().includes('vesiskootteri') || false;
        
        return {
          type: 'Feature' as const,
          properties: {
            id: r.id,
            isSpeedLimit,
            isAmmattiliikenne,
            isVesiskootteri
          },
          geometry: r.geometry
        };
      });

      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features
      };

      console.log('🟢 Adding source with', features.length, 'features');
      
      map.addSource('all-restrictions', {
        type: 'geojson',
        data: geojson
      });

      map.addLayer({
        id: 'all-restrictions-fill',
        type: 'fill',
        source: 'all-restrictions',
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.3
        }
      });

      map.addLayer({
        id: 'all-restrictions-line',
        type: 'line',
        source: 'all-restrictions',
        paint: {
          'line-color': '#2563eb',
          'line-width': 2
        }
      });

      console.log('🟢 Areas displayed successfully');
      setAreasDisplayed(true);
    } catch (error) {
      console.error('🟢 Error loading areas:', error);
    }
  };

  // Update layer filters when filters change
  useEffect(() => {
    if (!mapRef.current || !areasDisplayed) return;

    const map = mapRef.current;
    console.log('🔄 Updating filters:', filters);

    // Build filter expression
    // Show areas that match the active filters
    const filterExpr: any[] = ['all'];

    // If ammattiliikenne is OFF, hide areas marked as ammattiliikenne
    if (!filters.ammattiliikenne) {
      filterExpr.push(['!=', ['get', 'isAmmattiliikenne'], true]);
    }

    // If vesiskootteri is OFF, hide vesiskootteri prohibition areas
    if (!filters.vesiskootteri) {
      filterExpr.push(['!=', ['get', 'isVesiskootteri'], true]);
    }

    // Apply filter to both layers
    map.setFilter('all-restrictions-fill', filterExpr);
    map.setFilter('all-restrictions-line', filterExpr);

    console.log('🔄 Filters applied:', filterExpr);
  }, [filters, areasDisplayed]);

  // Follow GPS position when enabled
  useEffect(() => {
    if (!mapRef.current || !boatPosition || !isFollowingGPS) return;

    const map = mapRef.current;

    map.flyTo({
      center: [boatPosition.lng, boatPosition.lat],
      zoom: 13,
      duration: 500
    });
  }, [boatPosition, isFollowingGPS]);

  // Track when user manually pans the map
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    const handleDragStart = () => {
      setIsFollowingGPS(false);
    };

    map.on('dragstart', handleDragStart);

    return () => {
      map.off('dragstart', handleDragStart);
    };
  }, []);

  // Update sign markers
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    signMarkersRef.current.forEach(marker => marker.remove());
    signMarkersRef.current = [];

    signs.forEach(sign => {
      const el = document.createElement('div');
      el.className = 'sign-marker';

      const img = document.createElement('img');
      img.src = sign.iconUrl;
      img.alt = sign.nimiFi || 'Merkki';
      img.onerror = () => {
        const baseKey = sign.iconKey.split('_')[0];
        img.src = `/icons/${baseKey}.png`;
        img.onerror = () => {
          img.src = '/icons/merkki_default.png';
        };
      };

      el.appendChild(img);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(sign.geometry.coordinates as [number, number])
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(`
            <div class="sign-popup">
              <strong>${sign.nimiFi || sign.nimiSv || 'Merkki'}</strong>
              ${sign.lisakilmentekstiFi ? `<p>${sign.lisakilmentekstiFi}</p>` : ''}
              <p class="distance">${sign.distance} m</p>
            </div>
          `)
        )
        .addTo(map);

      signMarkersRef.current.push(marker);
    });
  }, [signs]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainerRef} className="map-container" />
      
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: '32px',
        pointerEvents: 'none',
        zIndex: 1000,
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
      }}>
        🚤
      </div>

      {!isFollowingGPS && boatPosition && (
        <button
          onClick={() => setIsFollowingGPS(true)}
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            padding: '12px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '48px',
            height: '48px',
            cursor: 'pointer',
            fontSize: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            zIndex: 1000
          }}
        >
          📍
        </button>
      )}
    </div>
  );
}

export default MapView;