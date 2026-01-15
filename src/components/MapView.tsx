// MapView - Ultra simple version
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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isFollowingGPS, setIsFollowingGPS] = useState(true);

  console.log('🔴 RENDER - mapContainerRef.current:', mapContainerRef.current);
  console.log('🔴 RENDER - mapRef.current:', mapRef.current);

  // SINGLE useEffect for everything
  useEffect(() => {
    console.log('🟢 useEffect RUNNING');
    console.log('🟢 mapContainerRef.current:', mapContainerRef.current);
    console.log('🟢 mapRef.current:', mapRef.current);

    if (mapRef.current) {
      console.log('🟢 Map already exists, skipping init');
      return;
    }

    if (!mapContainerRef.current) {
      console.log('🟢 No container yet');
      return;
    }

    console.log('🟢 Creating map NOW!');

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
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
      },
      center: [25.0, 60.5],
      zoom: 8
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    console.log('🟢 Map created! Waiting for load event...');

    map.on('load', async () => {
      console.log('🟣 MAP LOADED EVENT!');
      
      const allAreas = await db.restriction_areas.toArray();
      console.log('🟣 Got', allAreas.length, 'areas');

      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: allAreas
          .filter(r => {
            if (!r.geometry?.coordinates) return false;
      
            // Recursively check coordinates are valid numbers
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
          })
          .map(r => ({
            type: 'Feature' as const,
            properties: { id: r.id },
            geometry: r.geometry
          }))
      };

      console.log('🟣 Adding', geojson.features.length, 'features to map');

      map.addSource('all-restrictions', { type: 'geojson', data: geojson });
      map.addLayer({
        id: 'all-restrictions-fill',
        type: 'fill',
        source: 'all-restrictions',
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.3 }
      });
      map.addLayer({
        id: 'all-restrictions-line',
        type: 'line',
        source: 'all-restrictions',
        paint: { 'line-color': '#2563eb', 'line-width': 2 }
      });

      console.log('🟣 DONE!');
    });

    return () => {
      console.log('🟢 Cleanup');
      map.remove();
      mapRef.current = null;
    };
  });

  // GPS follow
  useEffect(() => {
    if (!mapRef.current || !boatPosition || !isFollowingGPS) return;
    mapRef.current.flyTo({ center: [boatPosition.lng, boatPosition.lat], zoom: 13, duration: 500 });
  }, [boatPosition, isFollowingGPS]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainerRef} className="map-container" />
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)', fontSize: '32px',
        pointerEvents: 'none', zIndex: 1000
      }}>🚤</div>
      {!isFollowingGPS && boatPosition && (
        <button onClick={() => setIsFollowingGPS(true)} style={{
          position: 'absolute', right: '10px', top: '50%',
          transform: 'translateY(-50%)', padding: '12px',
          backgroundColor: '#3b82f6', color: 'white',
          border: 'none', borderRadius: '50%',
          width: '48px', height: '48px', cursor: 'pointer',
          fontSize: '20px', zIndex: 1000
        }}>📍</button>
      )}
    </div>
  );
}

export default MapView;