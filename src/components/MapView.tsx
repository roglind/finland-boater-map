// MapView with centered boat and manual positioning
import { db } from '../data/db';
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { BoatPosition, ApplicableRestriction, NearbySign } from '../types';
import './MapView.css';

interface MapViewProps {
  boatPosition: BoatPosition | null;
  restrictions: ApplicableRestriction[];
  signs: NearbySign[];
}

function MapView({ boatPosition, restrictions, signs }: MapViewProps) {
  console.log('🗺️ MapView render:', {
    position: boatPosition,
    restrictionsCount: restrictions.length,
    signsCount: signs.length
  });

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const signMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [isFollowingGPS, setIsFollowingGPS] = useState(true);

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
      center: [25.0, 60.5], // Default to Finland
      zoom: 8,
      attributionControl: true
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    mapRef.current = map;

    // Try to add restriction areas (function waits for map load itself)
    displayAllAreas();

    return () => {
      // cleanup markers
      signMarkersRef.current.forEach(m => m.remove());
      // remove map
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  // Follow GPS position when enabled
  useEffect(() => {
    if (!mapRef.current || !boatPosition || !isFollowingGPS) return;

    const map = mapRef.current;

    // Center map on GPS position
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
      // User manually dragged, stop following GPS
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

    // Remove old markers
    signMarkersRef.current.forEach(marker => marker.remove());
    signMarkersRef.current = [];

    // Add new markers
    signs.forEach(sign => {
      const el = document.createElement('div');
      el.className = 'sign-marker';

      const img = document.createElement('img');
      img.src = sign.iconUrl;
      img.alt = sign.nimiFi || 'Merkki';
      img.onerror = () => {
        // Try fallback without rajoitusarvo
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

  console.log('🔴🔴🔴 CODE EXISTS - About to define all-areas function');

  // Display ALL restriction areas - called directly
  const displayAllAreas = () => {
    console.log('🟢 displayAllAreas function called');

    if (!mapRef.current) {
      console.log('🟢 No map ref, trying again in 1 second...');
      setTimeout(displayAllAreas, 1000);
      return;
    }

    const map = mapRef.current;
    console.log('🟢 Map ref exists, checking if loaded:', map.loaded());

    if (!map.loaded()) {
      console.log('🟢 Map not loaded, waiting...');
      map.once('load', () => {
        console.log('🟢 Map load event fired');
        addAllAreasToMap(map);
      });
    } else {
      console.log('🟢 Map already loaded');
      addAllAreasToMap(map);
    }
  };

  const addAllAreasToMap = (map: maplibregl.Map) => {
    console.log('🟢 Adding all areas to map...');

    db.restriction_areas
      .toArray()
      .then(allAreas => {
        console.log('🟢 Loaded', allAreas.length, 'areas from DB');

        if (allAreas.length === 0) {
          console.log('🟢 No areas to display');
          return;
        }

        // Remove old layers/sources if they exist
        try {
          if (map.getLayer('all-restrictions-fill')) map.removeLayer('all-restrictions-fill');
          if (map.getLayer('all-restrictions-line')) map.removeLayer('all-restrictions-line');
          if (map.getSource('all-restrictions')) map.removeSource('all-restrictions');
        } catch (e) {
          console.log('🟢 Removed old layers');
        }

        // Validate and filter geometries
        const validAreas = allAreas.filter(r => {
          if (!r.geometry || !r.geometry.coordinates) {
            return false;
          }
        
          // Check if coordinates contain valid numbers
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

        console.log('🟢 Valid areas:', validAreas.length, 'out of', allAreas.length);

        if (validAreas.length === 0) {
          console.log('🟢 No valid geometries to display!');
          return;
        }

        const geojson: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: validAreas.map(r => ({
            type: 'Feature',
            properties: { id: r.id },
            geometry: r.geometry
          }))
        };

        console.log('🟢 Adding source with', geojson.features.length, 'features');
      
        try {
          map.addSource('all-restrictions', {
            type: 'geojson',
            data: geojson
          });

          console.log('🟢 Adding layers (BLUE color)');
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

          console.log('🟢 SUCCESS! Layers added!');
        } catch (error) {
          console.error('🟢 Error adding layers:', error);
        }
      })
      .catch(error => {
        console.error('🟢 Error loading areas:', error);
      });
  };

  // Call it on every render attempt (it will early-return / retry if map not ready)
  displayAllAreas();

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainerRef} className="map-container" />
      
      {/* Boat icon fixed at screen center */}
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

      {/* Re-center button - only shows when not following GPS */}
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