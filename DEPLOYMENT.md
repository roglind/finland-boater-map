# Deployment Guide

## Prerequisites

Before deploying, ensure you have:

1. ✅ All traffic sign icons in `public/icons/`
2. ✅ App icons (`icon-192.png` and `icon-512.png`)
3. ✅ Favicon (`favicon.ico`)
4. ✅ Production build tested locally

## Build Process

```bash
# Install dependencies
npm install

# Type check
npm run type-check

# Build for production
npm run build
```

The build output will be in the `dist/` directory.

## Deployment Options

### Option 1: Static Hosting (Netlify, Vercel, GitHub Pages)

#### Netlify

1. Install Netlify CLI:
```bash
npm install -g netlify-cli
```

2. Deploy:
```bash
netlify deploy --prod --dir=dist
```

Or connect your GitHub repo to Netlify for automatic deployments.

**netlify.toml** (already configured):
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### Vercel

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel --prod
```

#### GitHub Pages

1. Install gh-pages:
```bash
npm install --save-dev gh-pages
```

2. Add to package.json:
```json
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d dist"
}
```

3. Deploy:
```bash
npm run deploy
```

### Option 2: Self-hosted (Apache/Nginx)

#### Nginx Configuration

```nginx
server {
    listen 80;
    server_name boatermap.example.com;
    root /var/www/boater-map-pwa/dist;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/json application/javascript;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Service worker - no cache
    location = /sw.js {
        expires off;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # PWA manifest
    location = /manifest.json {
        add_header Cache-Control "public, max-age=3600";
    }

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # CORS headers for map tiles
    location ~* \.(png|jpg|jpeg)$ {
        add_header Access-Control-Allow-Origin "*";
    }
}
```

#### Apache Configuration

```apache
<VirtualHost *:80>
    ServerName boatermap.example.com
    DocumentRoot /var/www/boater-map-pwa/dist

    <Directory /var/www/boater-map-pwa/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted

        # SPA routing
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>

    # Enable compression
    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
    </IfModule>

    # Cache static assets
    <FilesMatch "\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$">
        Header set Cache-Control "max-age=31536000, public, immutable"
    </FilesMatch>

    # Service worker - no cache
    <Files "sw.js">
        Header set Cache-Control "no-cache, no-store, must-revalidate"
    </Files>
</VirtualHost>
```

## HTTPS Setup (Required for Geolocation)

### Let's Encrypt (Certbot)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d boatermap.example.com

# Auto-renewal is configured automatically
```

## Environment Considerations

### Production Checklist

- [ ] HTTPS enabled (required for geolocation API)
- [ ] Service worker registered and working
- [ ] All icons present in `public/icons/`
- [ ] CORS headers configured for external resources
- [ ] Compression enabled (gzip/brotli)
- [ ] Cache headers configured properly
- [ ] Error logging configured
- [ ] Analytics setup (optional)

### Performance Optimization

1. **Enable HTTP/2**
   - Significantly improves load times
   - Most modern servers support it

2. **CDN for Icons**
   - Consider hosting icons on a CDN
   - Reduces server load and improves global latency

3. **Preload Critical Resources**
   - Already configured in `index.html`
   - MapLibre CSS is preloaded

4. **Monitor Bundle Size**
   ```bash
   npm run build -- --report
   ```

### Monitoring

Set up monitoring for:

- Service worker registration errors
- Failed data downloads
- Geolocation permission denials
- IndexedDB quota exceeded errors

Recommended tools:
- Sentry for error tracking
- Google Analytics for usage
- Lighthouse CI for performance monitoring

## Post-Deployment

1. Test on actual devices (not just desktop)
2. Verify PWA installability
3. Test offline functionality
4. Check performance with Lighthouse
5. Verify geolocation works on HTTPS

## Updating Data Sources

If Väylävirasto changes their URL structure:

1. Update URLs in `src/data/updater.ts`
2. Test download and parsing
3. Rebuild and redeploy

## Troubleshooting

### Service Worker Not Updating

```bash
# Force reload on all clients
# In browser console:
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
});
location.reload(true);
```

### Icons Not Loading in Production

- Check CORS headers
- Verify icon files are in dist/icons/
- Check browser console for 404s

### Database Issues

Users can clear app data:
1. Open browser DevTools
2. Application tab
3. Clear storage > Clear site data

## Scaling Considerations

For high traffic:

1. **CDN**: Use CloudFlare or similar
2. **API Caching**: Cache Väylävirasto responses
3. **Rate Limiting**: Implement if self-hosting icons
4. **Load Balancing**: For multiple servers

## Backup Strategy

Key data to backup:

- Source code (Git)
- Icon files
- Configuration files
- SSL certificates (if self-hosting)

Database (IndexedDB) is client-side only - no server backups needed.

## Security

- Keep dependencies updated: `npm audit`
- Use HTTPS everywhere
- Set appropriate CSP headers
- Regular security audits
