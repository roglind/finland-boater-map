# Finland Boater Speed Limits & Water Traffic Signs PWA

An offline-first progressive web app for displaying Finnish waterway restrictions and traffic signs on an interactive map.

## Features

- 🗺️ **Interactive Map** - Live GPS tracking with MapLibre GL JS
- 📡 **Offline-first** - Works without internet after initial data download
- 🚤 **Real-time Restrictions** - Shows applicable speed limits and restrictions based on your position
- 🪧 **Traffic Signs** - Displays nearby water traffic signs with icons
- 🔍 **Smart Filtering** - Filter by professional traffic, jet ski restrictions, and sign types
- 💾 **Efficient Storage** - Uses IndexedDB with spatial indexing for fast queries
- 📱 **Mobile-first** - Optimized for phones and tablets

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Map**: MapLibre GL JS
- **Offline**: Service Worker (Workbox) + IndexedDB (Dexie)
- **Geospatial**: Turf.js + RBush spatial indexing
- **Data Parsing**: SQL.js for GeoPackage files

## Installation

### Prerequisites

- Node.js 18+ and npm

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd boater-map-pwa
```

2. Install dependencies:
```bash
npm install
```

3. Create the icons directory:
```bash
mkdir -p public/icons
```

4. Add traffic sign icons to `public/icons/`:
   - Format: `merkkiXX_YY.png` (with rajoitusarvo) or `merkkiXX.png` (without)
   - Include `merkki_default.png` as fallback
   - XX = vlmlajityyppi, YY = rajoitusarvo

5. Create placeholder app icons:
```bash
# Create placeholder 192x192 icon
echo "Create icon-192.png in public/"
# Create placeholder 512x512 icon
echo "Create icon-512.png in public/"
```

## Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Building for Production

Build the production bundle:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Usage

### First Time Setup

1. Open the app in your browser
2. Click the "Päivitä aineisto" (Update Data) button
3. Wait for both datasets to download and parse (~12MB total)
4. Data is stored in IndexedDB for offline use

### Navigation

- **Map**: Shows your current position with a boat icon 🚤
- **Bottom Sheet**: Displays current restrictions and nearby signs
  - Tap to expand for full details
  - Shows speed limits, exceptions, and additional info
- **Settings**: Configure filters and preferences
  - Toggle professional traffic filter
  - Toggle jet ski restrictions
  - Adjust nearby signs radius
  - Select specific sign types to display

### Filters

**Ammattiliikenne (Professional Traffic)**
- When OFF: Hides restrictions with "huvi" (recreational) in exceptions
- When ON: Shows all restrictions

**Vesiskootteri (Jet Ski)**
- When OFF: Hides jet ski-specific restrictions
- When ON: Shows all restrictions

**Merkkityypit (Sign Types)**
- Multi-select filter for traffic sign types
- Empty selection = show all signs

## Data Sources

The app uses public GeoPackage files from Väylävirasto (Finnish Transport Infrastructure Agency):

- **Restriction Areas**: `rajoitusalue_a.gpkg` (~11MB)
- **Traffic Signs**: `vesiliikennemerkit.gpkg` (~1.3MB)

Data is cached using HTTP ETags to avoid unnecessary re-downloads.

## Architecture

### Data Flow

1. **Download**: Fetch GPKG files from Väylävirasto
2. **Parse**: Web Worker parses GeoPackage using SQL.js
3. **Store**: Normalized data saved to IndexedDB
4. **Index**: Build spatial indexes (RBush) in memory
5. **Evaluate**: Check position against restrictions/signs every 1s or 10m movement

### File Structure

```
src/
├── components/         # React components
│   ├── MapView.tsx    # Map with markers and layers
│   ├── BottomSheet.tsx # Info panel
│   ├── SettingsPanel.tsx # Filter controls
│   └── UpdateButton.tsx # Data update UI
├── data/              # Data management
│   ├── db.ts         # Dexie IndexedDB schema
│   ├── updater.ts    # Download & update logic
│   └── parseGpkg.worker.ts # GeoPackage parser
├── logic/            # Business logic
│   ├── applicability.ts # Restriction filtering
│   ├── nearbySigns.ts  # Sign distance calculation
│   └── spatialIndex.ts # RBush spatial indexing
├── types.ts          # TypeScript definitions
└── App.tsx           # Main app component
```

## Performance Optimizations

- **Spatial Indexing**: RBush for O(log n) area queries
- **Web Workers**: Non-blocking GPKG parsing
- **Throttling**: Position evaluation limited to 1/sec
- **Movement Threshold**: Only re-evaluate after 10m movement
- **Bbox Pre-filtering**: Check bbox before point-in-polygon

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 15+
- Mobile browsers with geolocation support

## Offline Capabilities

After initial data download, the app works completely offline:

✅ Map display  
✅ GPS tracking  
✅ Restriction checking  
✅ Sign display  
✅ All filtering  

⚠️ Map tiles require internet (unless cached by browser)

## Troubleshooting

### Data won't download
- Check internet connection
- Check browser console for CORS errors
- Verify Väylävirasto URLs are accessible

### GPS not working
- Grant location permissions when prompted
- Enable location services on device
- Try in HTTPS context (required for geolocation)

### Icons not displaying
- Verify icons are in `public/icons/` directory
- Check file naming: `merkkiXX_YY.png` or `merkkiXX.png`
- Ensure `merkki_default.png` exists as fallback

### Performance issues
- Clear IndexedDB and re-download data
- Check spatial index is building correctly
- Reduce nearby signs radius in settings

## License

This project uses public data from Väylävirasto. Check their terms of use for data licensing.

## Contributing

Contributions welcome! Please ensure:

- TypeScript types are properly defined
- Components are mobile-responsive
- Performance impact is considered
- Tests pass (when implemented)

## Roadmap

- [ ] Add unit tests
- [ ] Implement offline map tiles
- [ ] Add route planning
- [ ] Export GPX tracks
- [ ] Multi-language support (Swedish)
- [ ] Dark mode
- [ ] Share location feature
