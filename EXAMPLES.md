# Example Usage Scenarios

## Scenario 1: First-Time User

### Steps

1. **Open App**
   - User opens https://boatermap.example.com
   - Sees map centered on Finland
   - Bottom sheet shows "Ei rajoituksia tai merkkejä lähistöllä"

2. **Grant Location Permission**
   - Browser prompts for location access
   - User clicks "Allow"
   - Map centers on user's location
   - Boat marker (🚤) appears

3. **Download Data**
   - User clicks "Päivitä aineisto" button
   - Progress shows:
     - "Ladataan rajoitusalueet..." (0-30%)
     - "Ladataan liikennemerkit..." (30-50%)
     - "Käsitellään rajoitusalueet..." (50-70%)
     - "Käsitellään liikennemerkit..." (70-85%)
     - "Tallennetaan tietokantaan..." (85-100%)
   - Success message: "Päivitys valmis!"
   - Last updated timestamp appears

4. **Navigate**
   - User moves boat (or simulates movement)
   - If entering restricted area:
     - Bottom sheet updates with restriction
     - Map shows red/orange polygon overlay
   - If near traffic signs:
     - Signs appear as markers on map
     - Bottom sheet lists nearest signs with distances

## Scenario 2: Recreational Boater in Speed Limit Zone

### Setup
- Location: Helsinki archipelago
- Multiple overlapping restrictions
- Several traffic signs nearby

### Expected Behavior

1. **Enters Area**
   - Bottom sheet shows: "Nopeusrajoitus 10 km/h" (badge: "Tärkein")
   - Secondary: "Aallokon aiheuttamisen kielto"
   - Map overlay: Red polygon for primary, orange for secondary

2. **Expands Bottom Sheet**
   - Sees full restriction details:
     - Poikkeus: "Ei koske huviliikenteen aluksia alle 12 metriä"
     - Lisätieto: "Rajoitus voimassa 1.5.-30.9."
     - Voimassa: 01.05.2024 - 30.09.2024

3. **Checks Settings**
   - Ammattiliikenne: ON (user boat is recreational)
   - Vesiskootteri: ON
   - Nearby radius: 250m

4. **Views Nearby Signs**
   - Sign 1: "Nopeusrajoitus 10 km/h" - 45m
   - Sign 2: "Ankurointi kielletty" - 120m
   - Sign 3: "Vaylämerkki" - 230m

## Scenario 3: Jet Ski User

### Settings Configuration

1. **Opens Settings**
   - Clicks gear icon
   - Scrolls to Vesiskootteri switch
   - Toggles OFF

2. **Effect**
   - Restrictions containing "vesiskootterilla" hidden
   - Map re-renders without jet ski zones
   - Bottom sheet updates

3. **Use Case**
   - Jet ski restrictions don't apply to regular boats
   - Cleaner, more relevant view for non-jet ski users

## Scenario 4: Offline Usage

### Preparation (Online)

1. Downloads data successfully
2. Browses area with restrictions
3. Data cached in IndexedDB (12+ MB)

### Going Offline

1. **Airplane Mode ON**
   - Network disconnected
   - Service worker active

2. **App Still Works**
   - ✅ Map UI loads
   - ✅ GPS updates continue
   - ✅ Restrictions checked
   - ✅ Signs displayed
   - ✅ All filters work
   - ⚠️ Map tiles may not load (depends on cache)

3. **Attempting Update**
   - Clicks "Päivitä aineisto"
   - Shows error: Network failure
   - Keeps existing offline dataset

## Scenario 5: Professional Fishing Vessel

### Settings

1. **Ammattiliikenne: ON**
   - Shows all restrictions including professional traffic
   
2. **Encounters Restriction**
   - "Nopeusrajoitus 8 km/h"
   - Poikkeus: "Ei koske huviliikenteen aluksia"
   - This restriction DOES apply (professional vessel)

3. **Recreational Boat**
   - Same location, Ammattiliikenne: OFF
   - Restriction hidden (applies to recreational)

## Scenario 6: Custom Sign Filtering

### Use Case: Focus on Speed Limits Only

1. **Open Settings**
   - Scroll to "Merkkityypit"
   - Click "Tyhjennä" to clear all

2. **Select Specific Types**
   - Check only type 3 (speed limits)
   - Check only type 12 (speed limits variant)

3. **Map Updates**
   - Only speed limit signs visible
   - Other signs (anchoring, direction, etc.) hidden
   - Bottom sheet shows only selected types

## Scenario 7: Performance Testing

### Large Dataset

1. **Data Loaded**
   - 10,000+ restriction polygons
   - 5,000+ traffic signs

2. **Position Updates**
   - GPS updates every second
   - Spatial index queries: ~10ms
   - Point-in-polygon: ~50ms
   - Total evaluation: <100ms ✅

3. **Smooth Experience**
   - Map panning: 60fps
   - No lag on position updates
   - Bottom sheet updates instantly

## Scenario 8: Edge Cases

### Multiple Overlapping Speed Limits

- Location: Area with 10, 15, and 20 km/h zones overlapping
- **Expected**: 
  - Primary badge on 10 km/h (lowest)
  - All three shown in list
  - 10 km/h displayed in header

### Date-Based Restrictions

- Current date: 15.06.2024
- Restriction A: Valid 01.05-30.09 ✅ Shows
- Restriction B: Valid 01.10-30.04 ❌ Hidden
- Restriction C: No date range ✅ Shows

### Sign at Exact Boundary

- Sign at 250.0m from boat
- Nearby radius: 250m
- **Expected**: Sign included (≤ not <)

### No Data Loaded

- First visit, no update clicked
- **Expected**:
  - Map works
  - GPS works
  - Bottom sheet: "Ei rajoituksia..."
  - Update button prominent

## Scenario 9: Data Update

### Checking for Updates

1. **ETag Unchanged**
   - Clicks "Päivitä aineisto"
   - Server returns 304 Not Modified
   - Keeps existing data
   - Message: "Data not modified"

2. **New Data Available**
   - Clicks "Päivitä aineisto"
   - Downloads new GPKG files
   - Parses changes
   - Updates IndexedDB atomically
   - Success message appears

## Scenario 10: Mobile Safari (iOS)

### PWA Installation

1. **Install Prompt**
   - Opens in Safari
   - Clicks Share button
   - Selects "Add to Home Screen"
   - Icon appears on home screen

2. **Standalone Mode**
   - Opens from home screen
   - Runs in standalone mode (no browser UI)
   - Status bar color: #0A4D68
   - Full-screen map experience

3. **Geolocation**
   - First launch prompts for location
   - "While Using App" permission
   - GPS updates work

## Testing Checklist

### Functional Tests

- [ ] Map loads and displays
- [ ] GPS position updates
- [ ] Data downloads successfully
- [ ] Restrictions detected correctly
- [ ] Signs displayed with proper icons
- [ ] Filters work as expected
- [ ] Settings persist across sessions
- [ ] Offline mode works
- [ ] Service worker caches assets
- [ ] PWA installable

### Performance Tests

- [ ] Initial load < 3s
- [ ] Position evaluation < 100ms
- [ ] Map rendering at 60fps
- [ ] No memory leaks
- [ ] IndexedDB operations fast
- [ ] Worker doesn't block UI

### Compatibility Tests

- [ ] Chrome (desktop & mobile)
- [ ] Firefox (desktop & mobile)
- [ ] Safari (desktop & mobile)
- [ ] Edge (desktop & mobile)
- [ ] Different screen sizes
- [ ] Touch and mouse input
- [ ] Landscape and portrait

### Edge Case Tests

- [ ] No GPS permission
- [ ] Network offline
- [ ] Corrupted IndexedDB
- [ ] Missing icons
- [ ] Invalid GPKG data
- [ ] Browser storage full
- [ ] Very large datasets

## Debug Commands

### Check IndexedDB

```javascript
// Open browser console
const db = await Dexie.exists('boater_map_db');
console.log('DB exists:', db);

// Get record counts
const areas = await db.restriction_areas.count();
const signs = await db.traffic_signs.count();
console.log('Areas:', areas, 'Signs:', signs);
```

### Simulate Position

```javascript
// In browser console
const mockPosition = {
  coords: {
    latitude: 60.1699,
    longitude: 24.9384,
    accuracy: 10
  },
  timestamp: Date.now()
};

// Trigger position callback manually
navigator.geolocation.getCurrentPosition = (callback) => {
  callback(mockPosition);
};
```

### Force Service Worker Update

```javascript
// In browser console
navigator.serviceWorker.getRegistrations()
  .then(regs => regs.forEach(reg => reg.update()));
```

## Expected Data Volumes

### After Full Update

- IndexedDB size: ~12-15 MB
- Restriction areas: ~8,000 records
- Traffic signs: ~4,000 records
- Cached assets: ~2 MB
- Total storage: ~15-20 MB

### Performance Targets

- Spatial index build: < 1s
- Area query: < 10ms
- Sign query: < 5ms
- Point-in-polygon (per area): < 1ms
- Total position evaluation: < 100ms
