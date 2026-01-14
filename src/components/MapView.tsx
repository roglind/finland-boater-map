// Fix debugging errors
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
  console.log('🔴🔴🔴 CODE EXISTS - About to define all-areas useEffect');  

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
  
    try {
      db.restriction_areas.toArray().then(allAreas => {
        console.log('🟢 Loaded', allAreas.length, 'areas from DB');
      
        if (allAreas.length === 0) {
          console.log('🟢 No areas to display');
          return;
        }
      
        // Remove old layers if they exist
        try {
          if (map.getLayer('all-restrictions-fill')) map.removeLayer('all-restrictions-fill');
          if (map.getLayer('all-restrictions-line')) map.removeLayer('all-restrictions-line');
          if (map.getSource('all-restrictions')) map.removeSource('all-restrictions');
        } catch (e) {
          console.log('🟢 Removed old layers (or they didnt exist)');
        }
      
        const geojson: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: allAreas.map(r => ({
            type: 'Feature',
            properties: { id: r.id },
            geometry: r.geometry
          }))
        };
    
        console.log('🟢 Adding source with', geojson.features.length, 'features');
        map.addSource('all-restrictions', {
          type: 'geojson',
          data: geojson
        });
    
        console.log('🟢 Adding layers (RED color, high opacity)');
        map.addLayer({
          id: 'all-restrictions-fill',
          type: 'fill',
          source: 'all-restrictions',
          paint: {
            'fill-color': '#ff0000',
            'fill-opacity': 0.5
          }
        });
    
        map.addLayer({
          id: 'all-restrictions-line',
          type: 'line',
          source: 'all-restrictions',
          paint: {
            'line-color': '#ff0000',
            'line-width': 3
          }
        });
        
        console.log('🟢 SUCCESS! Red polygons should be visible now!');
      }).catch(error => {
        console.error('🟢 Promise error loading areas:', error);
        console.error('🟢 Error details:', JSON.stringify(error));
      });
    } catch (error) {
      console.error('🟢 Try-catch error:', error);
    }
  };  
      console.log('🟢 Adding source with', geojson.features.length, 'features');
      map.addSource('all-restrictions', {
        type: 'geojson',
        data: geojson
      });
  
      console.log('🟢 Adding layers (RED color, high opacity)');
      map.addLayer({
        id: 'all-restrictions-fill',
        type: 'fill',
        source: 'all-restrictions',
        paint: {
          'fill-color': '#ff0000',
          'fill-opacity': 0.5
        }
      });
  
      map.addLayer({
        id: 'all-restrictions-line',
        type: 'line',
        source: 'all-restrictions',
        paint: {
          'line-color': '#ff0000',
          'line-width': 3
        }
      });
    
      console.log('🟢 SUCCESS! Red polygons should be visible now!');
    }).catch(error => {
      console.error('🟢 Error loading areas:', error);
    });
  };

  // Call it on every render
  displayAllAreas();
 
  return (
    <div ref={mapContainerRef} className="map-container" />
  );
}

export default MapView;
