import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { BoatPosition, NearbySign, AppFilters, RestrictionArea } from '../types';
import { formatSignName, getDefaultIconUrl, getIconUrl } from '../logic/nearbySigns';
import { textContainsJetSki } from '../logic/applicability';
import './MapView.css';

function buildRestrictionsGeoJSON(areas: RestrictionArea[]): GeoJSON.FeatureCollection {
  const checkCoords = (coords: unknown): boolean => {
    if (Array.isArray(coords)) {
      if (coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        return isFinite(coords[0]) && isFinite(coords[1]) && coords[0] !== 0 && coords[1] !== 0;
      }
    return (coords as unknown[]).every(c => checkCoords(c));
    }
    return false;
  };
  return {
    type: 'FeatureCollection',
    features: areas
      .filter(r => r.geometry?.coordinates && checkCoords(r.geometry.coordinates))
      .map(r => ({
        type: 'Feature' as const,
        properties: {
          id: r.id,
          isVesiskootteri: textContainsJetSki(r)
        },
        geometry: r.geometry
      }))
  };
}

interface MapViewProps {
  boatPosition: BoatPosition | null;
  restrictionAreas: RestrictionArea[];
  signs: NearbySign[];
  filters: AppFilters;
  mode: 'gps' | 'viewport';
  onRequestGpsMode?: () => void;
  onMapViewportChange?: (lng: number, lat: number, bounds: { sw: { lng: number; lat: number }; ne: { lng: number; lat: number } } | null) => void;
  onMapDragStart?: () => void;
  onMarkersRendered?: (count: number) => void;
}

function MapView({
  boatPosition,
  restrictionAreas,
  signs,
  filters,
  mode,
  onRequestGpsMode,
  onMapViewportChange,
  onMapDragStart,
  onMarkersRendered
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const boatMarkerRef = useRef<maplibregl.Marker | null>(null);
  const signMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const viewportCallbackRef = useRef<MapViewProps['onMapViewportChange']>(onMapViewportChange);
  const dragStartCallbackRef = useRef<MapViewProps['onMapDragStart']>(onMapDragStart);

  useEffect(() => {
    viewportCallbackRef.current = onMapViewportChange;
  }, [onMapViewportChange]);

  useEffect(() => {
    dragStartCallbackRef.current = onMapDragStart;
  }, [onMapDragStart]);

  // Initialize map once on mount
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return; // Already initialized

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

    const reportViewport = () => {
      if (!viewportCallbackRef.current) return;
      try {
        const center = map.getCenter();
        const b = map.getBounds();
        viewportCallbackRef.current(center.lng, center.lat, {
          sw: { lng: b.getWest(), lat: b.getSouth() },
          ne: { lng: b.getEast(), lat: b.getNorth() }
        });
      } catch {
        viewportCallbackRef.current(map.getCenter().lng, map.getCenter().lat, null);
      }
    };

    const onLoad = () => {
      if (!map.getSource('all-restrictions')) {
        map.addSource('all-restrictions', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }
      if (!map.getLayer('all-restrictions-fill')) {
        map.addLayer({
          id: 'all-restrictions-fill',
          type: 'fill',
          source: 'all-restrictions',
          paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.3 }
        });
      }
      if (!map.getLayer('all-restrictions-line')) {
        map.addLayer({
          id: 'all-restrictions-line',
          type: 'line',
          source: 'all-restrictions',
          paint: { 'line-color': '#2563eb', 'line-width': 2 }
        });
      }
      setMapReady(true);
      setTimeout(reportViewport, 0);
    };

    const onMoveEnd = () => {
      reportViewport();
    };

    const onDragStart = () => {
      dragStartCallbackRef.current?.();
    };

    map.on('load', onLoad);
    map.on('moveend', onMoveEnd);
    map.on('dragstart', onDragStart);

    return () => {
      map.off('load', onLoad);
      map.off('moveend', onMoveEnd);
      map.off('dragstart', onDragStart);
      boatMarkerRef.current?.remove();
      boatMarkerRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, []); // Run once on mount

  // Update restriction areas from App state (single source of truth)
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;
    if (!map.isStyleLoaded()) return;
    const source = map.getSource('all-restrictions') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData(buildRestrictionsGeoJSON(restrictionAreas));
  }, [restrictionAreas, mapReady]);

  // Update filters
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;
    const filterExpr: any[] = ['all'];

    if (!filters.vesiskootteri) {
      filterExpr.push(['!=', ['get', 'isVesiskootteri'], true]);
    }

    map.setFilter('all-restrictions-fill', filterExpr);
    map.setFilter('all-restrictions-line', filterExpr);
  }, [filters, mapReady]);

  // GPS follow only in GPS mode - preserve current zoom when recentering
  useEffect(() => {
    if (!mapRef.current || !boatPosition || mode !== 'gps') return;
    const map = mapRef.current;
    const currentZoom = map.getZoom();
    map.flyTo({ center: [boatPosition.lng, boatPosition.lat], zoom: currentZoom, duration: 500 });
  }, [boatPosition, mode]);

  // Boat marker at GPS position (fixes zoom-dependent offset)
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;

    if (!boatPosition) {
      boatMarkerRef.current?.remove();
      boatMarkerRef.current = null;
      return;
    }

    if (!boatMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'boat-marker';
      el.textContent = '🚤';
      boatMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([boatPosition.lng, boatPosition.lat])
        .addTo(map);
    } else {
      boatMarkerRef.current.setLngLat([boatPosition.lng, boatPosition.lat]);
    }
  }, [boatPosition, mapReady]);

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
      img.alt = formatSignName(sign);
      img.onerror = () => {
        img.src = getIconUrl(sign.iconKey.split('_')[0]);
        img.onerror = () => {
          img.src = getDefaultIconUrl();
          img.onerror = () => {
            img.classList.add('sign-marker-fallback');
            img.alt = 'Merkki';
          };
        };
      };
      el.appendChild(img);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(sign.geometry.coordinates as [number, number])
        .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(`
          <div class="sign-popup">
            <strong>${formatSignName(sign)}</strong>
            ${sign.lisakilventekstiFi ? `<p>${sign.lisakilventekstiFi}</p>` : ''}
            <p class="distance">${sign.distance} m</p>
          </div>
        `))
        .addTo(map);

      signMarkersRef.current.push(marker);
    });
    onMarkersRendered?.(signMarkersRef.current.length);
  }, [signs, onMarkersRendered]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', flex: 1, minHeight: 0 }}>
      <div ref={mapContainerRef} className="map-container" />
      {mode === 'viewport' && boatPosition && (
        <button onClick={onRequestGpsMode} style={{
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