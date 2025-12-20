# Development Guide

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Git
- Modern browser with geolocation support

### Initial Setup

```bash
# Clone repository
git clone <repository-url>
cd boater-map-pwa

# Run setup script
./setup.sh

# Or manual setup:
npm install
mkdir -p public/icons
```

### Development Server

```bash
npm run dev
```

Runs at `http://localhost:5173`

### Type Checking

```bash
npm run type-check
```

Runs TypeScript compiler without emitting files.

## Project Structure

```
boater-map-pwa/
├── public/               # Static assets
│   ├── icons/           # Traffic sign icons
│   ├── icon-192.png    # PWA icon
│   ├── icon-512.png    # PWA icon
│   └── favicon.ico
├── src/
│   ├── components/      # React components
│   │   ├── MapView.tsx
│   │   ├── BottomSheet.tsx
│   │   ├── SettingsPanel.tsx
│   │   └── UpdateButton.tsx
│   ├── data/           # Data layer
│   │   ├── db.ts       # IndexedDB schema
│   │   ├── updater.ts  # Data fetching
│   │   └── parseGpkg.worker.ts
│   ├── logic/          # Business logic
│   │   ├── applicability.ts
│   │   ├── nearbySigns.ts
│   │   └── spatialIndex.ts
│   ├── types.ts        # TypeScript types
│   ├── App.tsx         # Main component
│   └── main.tsx        # Entry point
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Key Technologies

### React + TypeScript
- Functional components with hooks
- Strict TypeScript for type safety
- No class components

### Vite
- Fast HMR (Hot Module Replacement)
- Optimized production builds
- Native ES modules

### MapLibre GL JS
- Open-source map library
- Vector tiles support
- Hardware-accelerated rendering

### Dexie (IndexedDB)
- Reactive hooks with `dexie-react-hooks`
- Promise-based API
- Efficient bulk operations

### Turf.js
- Geospatial calculations
- Point-in-polygon checks
- Distance calculations

### RBush
- R-tree spatial index
- Fast bbox queries
- O(log n) complexity

## Development Workflow

### Feature Development

1. Create feature branch:
```bash
git checkout -b feature/your-feature
```

2. Make changes and test locally:
```bash
npm run dev
```

3. Type check:
```bash
npm run type-check
```

4. Build and test production:
```bash
npm run build
npm run preview
```

5. Commit and push:
```bash
git add .
git commit -m "feat: your feature description"
git push origin feature/your-feature
```

### Testing Geolocation

#### Desktop Chrome

1. Open DevTools (F12)
2. Click three dots > More tools > Sensors
3. Set location to custom (e.g., Helsinki: 60.1699, 24.9384)

#### Mobile Testing

1. Use real device for best results
2. Or use Chrome DevTools Device Mode
3. Enable location simulation

#### Localhost HTTPS (for secure context)

```bash
# Generate self-signed cert
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Update vite.config.ts
export default defineConfig({
  server: {
    https: {
      key: './key.pem',
      cert: './cert.pem'
    }
  }
})
```

### Testing Offline Mode

1. Load app and update data
2. Open DevTools > Application > Service Workers
3. Check "Offline" checkbox
4. Reload page - app should work

### Debugging

#### IndexedDB Inspection

Chrome DevTools > Application > Storage > IndexedDB > boater_map_db

#### Service Worker Debugging

Chrome DevTools > Application > Service Workers

#### Map Debugging

```javascript
// In browser console
mapRef.current.showTileBoundaries = true;
mapRef.current.showCollisionBoxes = true;
```

#### Performance Profiling

1. Chrome DevTools > Performance
2. Start recording
3. Navigate/interact with app
4. Stop recording
5. Analyze flamegraph

## Code Style

### TypeScript

```typescript
// Use explicit types
function calculateDistance(
  from: BoatPosition, 
  to: TrafficSign
): number {
  // ...
}

// Use interfaces for data models
interface TrafficSign {
  id: number;
  geometry: Point;
  // ...
}

// Use type for unions/aliases
type UpdateStatus = 'idle' | 'loading' | 'success' | 'error';
```

### React

```typescript
// Functional components with TypeScript
interface Props {
  data: SomeType;
  onAction: () => void;
}

function Component({ data, onAction }: Props) {
  // Use hooks at top level
  const [state, setState] = useState<Type>(initial);
  
  useEffect(() => {
    // Side effects
  }, [dependencies]);
  
  // Event handlers
  const handleClick = () => {
    // ...
  };
  
  return <div>...</div>;
}
```

### Naming Conventions

- Components: PascalCase (`MapView`)
- Functions: camelCase (`calculateDistance`)
- Constants: UPPER_SNAKE_CASE (`DEFAULT_RADIUS`)
- Files: Match component name or camelCase
- CSS classes: kebab-case (`bottom-sheet`)

### File Organization

```typescript
// 1. Imports (grouped)
import { useState } from 'react'; // React
import type { SomeType } from './types'; // Types
import { helper } from './utils'; // Local
import './Component.css'; // Styles

// 2. Types/Interfaces
interface Props { }

// 3. Component
function Component() { }

// 4. Export
export default Component;
```

## Common Development Tasks

### Adding a New Filter

1. Add to `AppFilters` type in `types.ts`
2. Add state in `App.tsx`
3. Add UI in `SettingsPanel.tsx`
4. Apply logic in `applicability.ts` or `nearbySigns.ts`

### Adding a New Data Source

1. Add URL constant in `updater.ts`
2. Add table to Dexie schema in `db.ts`
3. Add parser in `parseGpkg.worker.ts`
4. Update spatial index if needed

### Modifying Map Layers

1. Edit MapView.tsx
2. Modify layer definitions in useEffect
3. Update GeoJSON generation if needed

### Performance Optimization

Common optimizations:

1. **Memoization**
```typescript
const expensiveValue = useMemo(
  () => computeExpensive(data),
  [data]
);
```

2. **Debouncing**
```typescript
const debouncedSearch = useMemo(
  () => debounce(search, 300),
  []
);
```

3. **Virtualization**
For long lists, use react-window or similar.

4. **Web Workers**
Move heavy computation to workers.

## Troubleshooting

### HMR Not Working
- Check for circular dependencies
- Restart dev server
- Clear node_modules and reinstall

### Type Errors
```bash
# Clear TypeScript cache
rm -rf node_modules/.vite
rm -rf tsconfig.tsbuildinfo
```

### Build Errors
```bash
# Clean build
rm -rf dist
npm run build
```

### Worker Issues
- Check worker path in import
- Verify worker is in correct directory
- Check browser console for worker errors

## Performance Benchmarks

Target metrics:

- Initial load: < 3s
- Time to interactive: < 5s
- Position evaluation: < 100ms
- Map render: 60fps
- Bundle size: < 500KB (gzipped)

Measure with:
```bash
npm run build
ls -lh dist/assets/*.js
```

## Contributing Guidelines

1. Follow existing code style
2. Add TypeScript types for everything
3. Write meaningful commit messages
4. Test on mobile before submitting
5. Update documentation if needed
6. Consider performance impact

## Resources

- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [MapLibre GL JS](https://maplibre.org/)
- [Turf.js](https://turfjs.org/)
- [Dexie.js](https://dexie.org/)
- [TypeScript](https://www.typescriptlang.org/)

## Getting Help

- Check existing issues on GitHub
- Review this documentation
- Ask in project discussions
- Check browser console for errors
