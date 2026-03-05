#!/bin/bash

# Finland Boater Map PWA - Setup Script

set -e

echo "🚤 Finland Boater Map PWA - Setup"
echo "=================================="
echo ""

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Create directories
echo "📁 Creating directories..."
mkdir -p public/images
mkdir -p public
echo "✅ Directories created"
echo ""

# Create placeholder icons
echo "🎨 Creating placeholder icons..."

# Create a simple SVG for default icon
cat > public/images/merkki_default.png.svg << 'EOF'
<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" fill="#0A4D68"/>
  <text x="32" y="40" text-anchor="middle" fill="white" font-size="32" font-family="Arial">?</text>
</svg>
EOF

# Create placeholder app icons
cat > public/icon-192.svg << 'EOF'
<svg width="192" height="192" xmlns="http://www.w3.org/2000/svg">
  <rect width="192" height="192" fill="#0A4D68"/>
  <text x="96" y="130" text-anchor="middle" fill="white" font-size="80" font-family="Arial">🚤</text>
</svg>
EOF

cat > public/icon-512.svg << 'EOF'
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#0A4D68"/>
  <text x="256" y="340" text-anchor="middle" fill="white" font-size="220" font-family="Arial">🚤</text>
</svg>
EOF

echo "✅ Placeholder icons created"
echo ""

# Create .env.example
echo "📝 Creating .env.example..."
cat > .env.example << 'EOF'
# Vite environment variables
# Copy this file to .env.local and adjust as needed

# Public variables (exposed to client)
VITE_APP_TITLE=Veneilijän Kartta
VITE_MAP_DEFAULT_CENTER=25.0,60.5
VITE_MAP_DEFAULT_ZOOM=8
EOF
echo "✅ .env.example created"
echo ""

# Type check
echo "🔍 Running type check..."
npm run type-check
echo "✅ Type check passed"
echo ""

echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add your traffic sign icons to public/images/"
echo "   Format: merkkiXX_YY.png or merkkiXX.png"
echo ""
echo "2. Start the development server:"
echo "   npm run dev"
echo ""
echo "3. Open http://localhost:5173 in your browser"
echo ""
echo "4. Click 'Päivitä aineisto' to download data"
echo ""
echo "For production deployment, see DEPLOYMENT.md"
echo ""
