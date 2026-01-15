// MapView - State-based initialization
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
  const signMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [isFollowingGPS, setIsFollowingGPS] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map once on mount
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return; // Already initialized

    console.log('🟢 Initializing map...');

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

    map.on('load', async () => {
      console.log('🟢 Map loaded! Adding areas...');
      
      const allAreas = await db.restriction_areas.toArray();
      console.log('🟢 Got', allAreas.length, 'areas');

      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: allAreas
          .filter(r => {
            if (!r.geometry?.coordinates) return false;
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
            properties: {
              id: r.id,
              isAmmattiliikenne: r.lisatieto?.toLowerCase().includes('ammatti') || false,
              isVesiskootteri: r.rajoitustyyppi?.toLowerCase().includes('vesiskootteri') || 
                               r.rajoitustyypit?.toLowerCase().includes('vesiskootteri') || false
            },
            geometry: r.geometry
          }))
      };

      console.log('🟢 Adding', geojson.features.length, 'features');
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

      console.log('🟢 Map ready!');
      setMapReady(true);
    });

    return () => {
      console.log('🟢 Cleanup - removing map');
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, []); // Run once on mount

  // Update filters
  useEffect(() => {
    console.log('🔵 Filter effect - mapReady:', mapReady);
    
    if (!mapRef.current || !mapReady) {
      console.log('🔵 Not ready yet');
      return;
    }

    console.log('🔵 Applying filters:', filters);
    const map = mapRef.current;
    const filterExpr: any[] = ['all'];

    if (!filters.ammattiliikenne) {
      filterExpr.push(['!=', ['get', 'isAmmattiliikenne'], true]);
    }
    if (!filters.vesiskootteri) {
      filterExpr.push(['!=', ['get', 'isVesiskootteri'], true]);
    }

    console.log('🔵 Filter expression:', filterExpr);
    map.setFilter('all-restrictions-fill', filterExpr);
    map.setFilter('all-restrictions-line', filterExpr);
    console.log('🔵 Done!');
  }, [filters, mapReady]);

  // GPS follow
  useEffect(() => {
    if (!mapRef.current || !boatPosition || !isFollowingGPS) return;
    mapRef.current.flyTo({ center: [boatPosition.lng, boatPosition.lat], zoom: 13, duration: 500 });
  }, [boatPosition, isFollowingGPS]);

  // Track dragging
  useEffect(() => {
    if (!mapRef.current) return;
    const handleDrag = () => setIsFollowingGPS(false);
    mapRef.current.on('dragstart', handleDrag);
    return () => mapRef.current?.off('dragstart', handleDrag);
  }, [mapReady]);

  // Update signs
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    signMarkersRef.current.forEach(m => m.remove());
    signMarkersRef.current = [];

    signs.forEach(sign => {
      const el = document.createElement('div');
      el.className = 'sign-marker';
      const img = document.createElement('img');
      img.src = sign.iconUrl;
      img.alt = sign.nimiFi || 'Merkki';
      img.onerror = () => {
        img.src = `/icons/${sign.iconKey.split('_')[0]}.png`;
        img.onerror = () => { img.src = '/icons/merkki_default.png'; };
      };
      el.appendChild(img);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(sign.geometry.coordinates as [number, number])
        .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(`
          <div class="sign-popup">
            <strong>${sign.nimiFi || sign.nimiSv || 'Merkki'}</strong>
            ${sign.lisakilmentekstiFi ? `<p>${sign.lisakilmentekstiFi}</p>` : ''}
            <p class="distance">${sign.distance} m</p>
          </div>
        `))
        .addTo(map);

      signMarkersRef.current.push(marker);
    });
  }, [signs]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainerRef} className="map-container" />
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)', fontSize: '32px',
        pointerEvents: 'none', zIndex: 1000,
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
      }}>🚤</div>
      {!isFollowingGPS && boatPosition && (
        <button onClick={() => setIsFollowingGPS(true)} style={{
          position: 'absolute', right: '10px', top: '50%',
          transform: 'translateY(-50%)', padding: '12px',
          backgroundColor: '#3b82f6', color: 'white',
          border: 'none', borderRadius: '50%',
          width: '48px', height: '48px', cursor: 'pointer',
          fontSize: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          zIndex: 1000
        }}>📍</button>
      )}
    </div>
  );
}

export default MapView;