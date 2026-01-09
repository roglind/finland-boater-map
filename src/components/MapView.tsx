// Display all areas4
import { db } from '../data/db';
import { useEffect, useRef } from 'react';
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
    signsCount: signs.length,
    restrictions: restrictions
  });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const signMarkersRef = useRef<maplibregl.Marker[]>([]);
  
  // Initialize map
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
    
    return () => {
      map.remove();
    };
  }, []);
  
  // Update boat position marker
  useEffect(() => {
    if (!mapRef.current || !boatPosition) return;
    
    const map = mapRef.current;
    
    if (!markerRef.current) {
      // Create boat marker
      const el = document.createElement('div');
      el.className = 'boat-marker';
      el.innerHTML = '🚤';
      
      markerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([boatPosition.lng, boatPosition.lat])
        .addTo(map);
      
      // Center map on first position
      map.flyTo({
        center: [boatPosition.lng, boatPosition.lat],
        zoom: 13,
        duration: 1000
      });
    } else {
      // Update existing marker
      markerRef.current.setLngLat([boatPosition.lng, boatPosition.lat]);
    }
    
    // Update heading rotation if available
    if (boatPosition.heading != null && markerRef.current) {
      const el = markerRef.current.getElement();
      el.style.transform = `rotate(${boatPosition.heading}deg)`;
    }
  }, [boatPosition]);
  
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
          new maplibregl.Popup({ offset: 25 })
            .setHTML(`
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
  
  // Display ALL restriction areas
  useEffect(() => {
    if (!mapRef.current) {
      console.log('🗺️ All-areas: No map ref');
      return;
    }

    const map = mapRef.current;
    console.log('🗺️ All-areas: Map ref exists');

    function addLayers() {
      console.log('🗺️ All-areas: Adding layers, map loaded:', map.loaded());
    
      // Remove existing layers
      if (map.getLayer('all-restrictions-fill')) {
        console.log('🗺️ All-areas: Removing old fill layer');
        map.removeLayer('all-restrictions-fill');
      }
      if (map.getLayer('all-restrictions-line')) {
        console.log('🗺️ All-areas: Removing old line layer');
        map.removeLayer('all-restrictions-line');
      }
      if (map.getSource('all-restrictions')) {
        console.log('🗺️ All-areas: Removing old source');
        map.removeSource('all-restrictions');
      }

      // Load and display ALL restriction areas
      console.log('🗺️ All-areas: Loading from IndexedDB...'); 
      db.restriction_areas.toArray().then(allAreas => {
        console.log('🗺️ All-areas: Loaded', allAreas.length, 'areas');
      
        if (allAreas.length === 0) {
          console.log('🗺️ All-areas: No areas to display');
          return;
        }
      
        const geojson: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: allAreas.map(r => ({
            type: 'Feature',
            properties: { id: r.id },
            geometry: r.geometry
          }))
        };
    
        console.log('🗺️ All-areas: Adding source with', geojson.features.length, 'features');
        map.addSource('all-restrictions', {
          type: 'geojson',
          data: geojson
        });
    
        console.log('🗺️ All-areas: Adding fill layer');
        map.addLayer({
          id: 'all-restrictions-fill',
          type: 'fill',
          source: 'all-restrictions',
          paint: {
            'fill-color': '#3b82f6',
            'fill-opacity': 0.3
          }
        });
    
        console.log('🗺️ All-areas: Adding line layer');
        map.addLayer({
          id: 'all-restrictions-line',
          type: 'line',
          source: 'all-restrictions',
          paint: {
            'line-color': '#2563eb',
            'line-width': 2
          }
        });
      
        console.log('🗺️ All-areas: Layers added successfully!');
    }).catch(error => {
        console.error('🗺️ All-areas: Error loading:', error);
      });
    }

    // Wait for map to load before adding layers
    if (map.loaded()) {
      console.log('🗺️ All-areas: Map already loaded');
      addLayers();
    } else {
      console.log('🗺️ All-areas: Waiting for map to load...');
      map.once('load', () => {
        console.log('🗺️ All-areas: Map load event fired');
        addLayers();
      });
    }
  }, [mapRef.current]); 
 
  return (
    <div ref={mapContainerRef} className="map-container" />
  );
}

export default MapView;
