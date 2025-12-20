# Quick Start Guide

Get up and running with the Finland Boater Map PWA in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Basic command line knowledge
- Web browser (Chrome, Firefox, Safari, or Edge)

## Installation

### Option 1: Automated Setup (Recommended)

```bash
# Navigate to project directory
cd boater-map-pwa

# Run setup script
chmod +x setup.sh
./setup.sh
```

### Option 2: Manual Setup

```bash
# Install dependencies
npm install

# Create directories
mkdir -p public/icons

# Run type check
npm run type-check
```

## Start Development

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

## First Steps in the App

### 1. Grant Location Permission

When prompted, click **Allow** to enable GPS tracking.

### 2. Download Data

Click the **"Päivitä aineisto"** button at the top-left.

Wait for:
- Restriction areas (~11MB) to download
- Traffic signs (~1.3MB) to download
- Data to be processed and saved

This takes ~30-60 seconds depending on your connection.

### 3. Navigate

- Your position appears as a boat icon 🚤
- Move around to see restrictions and signs
- Tap bottom sheet to expand for details

## Key Features

### Map
- **Pan**: Click/drag or touch/swipe
- **Zoom**: Mouse wheel or pinch gesture
- **Your Position**: Blue boat marker

### Bottom Sheet
- **Collapsed**: Shows current primary restriction
- **Expanded**: Full details of all restrictions and nearby signs
- **Tap header**: Toggle expand/collapse

### Settings (⚙️ icon)
- **Ammattiliikenne**: Filter professional traffic restrictions
- **Vesiskootteri**: Filter jet ski restrictions
- **Nearby radius**: Adjust detection range (50-1000m)
- **Sign types**: Select which signs to display

## Common Tasks

### Update Data

Click **"Päivitä aineisto"** to refresh from latest sources.

Data is cached with ETags - won't re-download if unchanged.

### Filter Restrictions

1. Click ⚙️ settings icon
2. Toggle switches:
   - **Ammattiliikenne OFF**: Hide recreational exceptions
   - **Vesiskootteri OFF**: Hide jet ski restrictions
3. Changes apply immediately

### Filter Signs

1. Open settings
2. Scroll to "Merkkityypit"
3. Select specific sign types to show
4. Or use "Valitse kaikki" / "Tyhjennä" buttons

### Adjust Detection Radius

1. Open settings
2. Find "Läheisten merkkien säde"
3. Drag slider (50-1000m)
4. See more/fewer nearby signs

## Testing Offline

1. Download data while online
2. Enable airplane mode (or disable network in DevTools)
3. Reload page
4. App should work fully offline ✅

## Keyboard Shortcuts

- **Esc**: Close settings panel
- **F12**: Open DevTools for debugging

## Mobile Installation (PWA)

### iOS (Safari)
1. Open in Safari
2. Tap Share button
3. "Add to Home Screen"
4. App icon appears on home screen

### Android (Chrome)
1. Open in Chrome
2. Tap menu (⋮)
3. "Add to Home screen" or "Install app"
4. App icon appears in app drawer

## Troubleshooting

### Map not loading
- Check internet connection
- Check browser console for errors
- Try refreshing page

### No GPS position
- Grant location permission when prompted
- Enable location services on device
- Check you're in a location with GPS signal

### Data won't download
- Check internet connection
- Try again in a few minutes
- Check browser console for specific errors

### Icons not showing
- Icons need to be added manually to `public/icons/`
- See `ICONS.md` for icon specifications
- Default fallback icon will show if specific icon missing

### App running slow
- Clear browser cache
- Clear IndexedDB (DevTools > Application > Storage)
- Re-download data
- Close other browser tabs

## Next Steps

- Read `README.md` for comprehensive documentation
- See `DEVELOPMENT.md` for development guidelines
- Check `EXAMPLES.md` for usage scenarios
- Review `ICONS.md` for icon requirements
- See `DEPLOYMENT.md` for production deployment

## Getting Help

### Check Logs

Browser console (F12) shows:
- Network requests
- Error messages
- Performance warnings

### Debug Mode

```javascript
// In browser console
localStorage.setItem('debug', 'true');
// Reload page
```

### Common Issues

**Q: Why is my position not updating?**
A: Check that location permission is granted and GPS is enabled.

**Q: Can I use without internet?**
A: Yes! After downloading data once, app works fully offline.

**Q: How often should I update data?**
A: Check monthly, or when you know restrictions have changed.

**Q: Why don't I see any icons?**
A: Icons must be added to `public/icons/`. See ICONS.md.

**Q: Is my data synced between devices?**
A: No, each device stores data locally. Must update on each device.

## Quick Reference

| Action | Button/Control |
|--------|---------------|
| Update data | "Päivitä aineisto" button (top-left) |
| Open settings | ⚙️ icon (top-left) |
| Expand details | Tap bottom sheet header |
| Zoom map | Mouse wheel / pinch |
| Pan map | Click-drag / swipe |
| Recenter | Currently not implemented (future feature) |

## Performance Tips

- Keep nearby radius reasonable (250-500m)
- Don't select all sign types if you don't need them
- Update data only when needed
- Close app when not in use to save battery

## Safety Notice

⚠️ **This app is for informational purposes only.**

- Always follow official maritime rules
- Check official sources for critical information
- Don't rely solely on this app for navigation
- Keep proper charts and safety equipment

## Enjoy! 🚤

Happy boating! For support or feedback, see the project repository.
