# Traffic Sign Icons Guide

## Icon Naming Convention

Icons must follow this naming pattern to be recognized by the app:

### Format 1: With Restriction Value
```
merkkiXX_YY.png
```
- `XX` = vlmlajityyppi (traffic sign category type)
- `YY` = rajoitusarvo (restriction value, e.g., speed limit)

**Examples:**
- `merkki12_50.png` - Sign type 12 with 50 km/h restriction
- `merkki15_30.png` - Sign type 15 with 30 km/h restriction
- `merkki08_100.png` - Sign type 8 with 100m restriction

### Format 2: Without Restriction Value
```
merkkiXX.png
```
- `XX` = vlmlajityyppi (traffic sign category type)

**Examples:**
- `merkki03.png` - Sign type 3 (no specific restriction value)
- `merkki07.png` - Sign type 7
- `merkki21.png` - Sign type 21

### Fallback Icon
```
merkki_default.png
```
Used when a specific icon is not found.

## Icon Specifications

- **Format**: PNG (with transparency recommended)
- **Size**: 64x64 pixels minimum, 128x128 recommended
- **Color**: Full color (app will display them as-is)
- **Background**: Transparent or white
- **File size**: Keep under 50KB per icon

## Icon Fallback Logic

The app tries to load icons in this order:

1. `merkkiXX_YY.png` (if rajoitusarvo exists)
2. `merkkiXX.png` (base type)
3. `merkki_default.png` (fallback)

Example for sign with vlmlajityyppi=12 and rajoitusarvo=50:
```
1. Try: merkki12_50.png
2. If not found, try: merkki12.png
3. If not found, use: merkki_default.png
```

## Directory Structure

```
public/
└── icons/
    ├── merkki_default.png    # Required fallback
    ├── merkki01.png
    ├── merkki02.png
    ├── merkki03.png
    ├── merkki03_30.png
    ├── merkki03_50.png
    ├── merkki12.png
    ├── merkki12_40.png
    ├── merkki12_50.png
    ├── merkki15.png
    ├── merkki15_30.png
    └── ...
```

## Getting Icon Assets

### Option 1: Official Finnish Traffic Signs
Contact Väylävirasto (Finnish Transport Infrastructure Agency) for official sign graphics.

### Option 2: Create Custom Icons
If official icons are not available, create custom icons following these guidelines:

1. **Colors**: Use official Finnish traffic sign colors
   - Prohibitory signs: Red circle with white background
   - Mandatory signs: Blue circle with white symbols
   - Warning signs: Yellow triangle with black symbols
   - Informative signs: Blue square with white symbols

2. **Symbols**: Keep simple and recognizable
3. **Text**: Use clear, legible fonts for speed limits
4. **Border**: Include standard sign borders

### Example Icon Creation (ImageMagick)

```bash
# Create a simple speed limit sign
convert -size 128x128 xc:white \
  -fill red -draw "circle 64,64 64,10" \
  -fill white -draw "circle 64,64 64,16" \
  -font Arial -pointsize 48 -fill black \
  -gravity center -annotate +0+0 "50" \
  merkki12_50.png
```

### Example Icon Creation (SVG)

```svg
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <!-- Red circle -->
  <circle cx="64" cy="64" r="54" fill="white" stroke="red" stroke-width="10"/>
  
  <!-- Speed limit text -->
  <text x="64" y="80" text-anchor="middle" font-size="48" font-family="Arial" font-weight="bold">50</text>
</svg>
```

## Testing Icons

1. Place your icons in `public/icons/`
2. Start the dev server: `npm run dev`
3. Update data to load sign information
4. Navigate to an area with traffic signs
5. Check if icons display correctly
6. Open browser console to see which icons failed to load

## Common Icon Types

Based on Finnish water traffic regulations:

| vlmlajityyppi | Description | Common rajoitusarvo |
|--------------|-------------|-------------------|
| 3 | Speed limit | 30, 40, 50, 60, 80 |
| 5 | No entry | - |
| 7 | No anchoring | - |
| 8 | No swimming | - |
| 12 | Speed limit (variant) | 30, 40, 50 |
| 15 | Minimum speed | 30 |
| 18 | Direction mandatory | - |
| 21 | Channel marker | - |

Note: This is a partial list. Refer to Finnish Maritime Administration documentation for complete list.

## Icon License

Ensure you have rights to use any icons you add:
- Official signs: Contact Väylävirasto
- Custom icons: Ensure they don't violate copyright
- Open source icons: Check license compatibility

## Troubleshooting

### Icons not displaying
1. Check file names exactly match pattern
2. Verify files are in `public/icons/` directory
3. Check browser console for 404 errors
4. Ensure `merkki_default.png` exists
5. Verify file extensions are lowercase `.png`

### Icons look pixelated
- Increase icon resolution to 128x128 or higher
- Use vector SVG and convert to high-res PNG

### Icons loading slowly
- Optimize PNG files (use tools like pngquant)
- Keep file sizes under 50KB
- Consider implementing lazy loading for distant signs

## Optimization

Optimize all icons before deployment:

```bash
# Using pngquant (install first)
pngquant --quality=65-80 --ext .png --force public/icons/*.png

# Or using imagemagick
mogrify -strip -quality 85 public/icons/*.png
```

This can reduce file sizes by 50-70% without visible quality loss.

## Future Enhancements

Potential improvements for icon handling:
- [ ] SVG support for scalable icons
- [ ] Icon sprite sheets for better performance
- [ ] CDN hosting for icons
- [ ] Progressive image loading
- [ ] Icon caching optimization
