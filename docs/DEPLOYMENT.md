# Deployment Guide - Energy Calculator

## 🚀 Übersicht

Dieses Projekt ist ein **statische Single-Page Application (SPA)** und kann auf jedem HTTP-Server gehostet werden. Keine Backend-Anforderungen.

---

## 📋 System-Anforderungen

### **Minimum**
- HTTP/HTTPS Server (z.B. Apache, Nginx, GitHub Pages)
- ~2.5 MB Speicherplatz
- SSL/TLS für Sicherheit

### **Empfohlen**
- HTTPS (für localStorage)
- Gzip Kompression
- CDN (für globale Performance)
- HTTP/2 Support

### **Browser-Support**
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- IE 11: **NICHT unterstützt** (nutzt ES6)

---

## 🏠 Lokale Entwicklung

### **Option 1: Python (einfach)**
```bash
cd energyplanning

# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Öffnen: http://localhost:8000
```

### **Option 2: Node.js**
```bash
# Installieren (falls nicht vorhanden)
npm install -g http-server

# Starten
http-server .

# Öffnen: http://localhost:8080
```

### **Option 3: VS Code Live Server**
```bash
# Extension installieren: "Live Server" (ritwickdey.liveserver)

# Mit Rechtsklick → "Open with Live Server"
# oder Shortcut: Alt+L, Alt+O
```

### **Option 4: Docker**
```dockerfile
# Dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
docker build -t energyplanning .
docker run -p 8080:80 energyplanning
```

---

## 📦 Production Deployment

### **Option 1: GitHub Pages (kostenlos, einfach)**

#### **Schritt 1: Repository Setup**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/username/energyplanning.git
git branch -M main
git push -u origin main
```

#### **Schritt 2: GitHub Pages aktivieren**
1. Repository → Settings
2. Pages → Branch: `main`, Folder: `/ (root)`
3. Speichern
4. URL: `https://username.github.io/energyplanning`

#### **Vorteil:**
- Kostenlos
- Automatische HTTPS
- Einfaches Deployment (Push = Live)

#### **Nachteile:**
- Public Repository erforderlich
- Custom Domain optional

---

### **Option 2: Netlify (kostenlos mit optionalen Features)**

#### **Schritt 1: Verbinden**
1. https://app.netlify.com → "New site from Git"
2. GitHub verbinden
3. Repository wählen
4. Build settings:
   - Build command: `(none)`
   - Publish directory: `.`
5. Deploy

#### **Schritt 2: Konfiguration (netlify.toml)**
```toml
[build]
  publish = "."
  command = ""

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "*.html"
  [headers.values]
    Cache-Control = "max-age=3600"

[[headers]]
  for = "*.js"
  [headers.values]
    Cache-Control = "max-age=31536000"
```

#### **Vorteil:**
- Einfaches Deployment
- Kostenlose HTTPS
- CDN inklusive
- Deploy Previews für PRs

---

### **Option 3: Herkömmlicher Web-Host (Apache/Nginx)**

#### **Apache (.htaccess)**
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  
  # Cache-Control Headers
  <FilesMatch "\.(js|css|json)$">
    Header set Cache-Control "public, max-age=31536000"
  </FilesMatch>
  
  <FilesMatch "\.(html)$">
    Header set Cache-Control "public, max-age=3600"
  </FilesMatch>
  
  # Enable Gzip
  <IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
  </IfModule>
  
  # HTTPS Redirect
  RewriteCond %{HTTPS} off
  RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>
```

#### **Nginx (nginx.conf)**
```nginx
server {
    listen 80;
    server_name energyplanning.de;
    
    # Redirect HTTP → HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name energyplanning.de;
    
    root /var/www/energyplanning;
    index index.html;
    
    # SSL Zertifikat (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/energyplanning.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/energyplanning.de/privkey.pem;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests; block-all-mixed-content" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header Permissions-Policy "accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), gyroscope=(), hid=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), speaker-selection=(), usb=(), web-share=(), xr-spatial-tracking=()" always;
    
    # Gzip Compression
    gzip on;
    gzip_types text/html text/plain text/css text/javascript application/javascript application/json;
    gzip_min_length 1000;
    
    # Cache Strategy
    location ~* \.(js|css|json)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    location ~* \.(html)$ {
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Deny access to sensitive files
    location ~ /\. {
        deny all;
    }
}
```

---

## 🔒 Security Checklist

- [ ] HTTPS aktiviert (SSL/TLS Zertifikat)
- [ ] Security Headers gesetzt (X-Frame-Options, CSP)
- [ ] Gzip Kompression aktiviert
- [ ] Cache-Control Headers konfiguriert
- [ ] robots.txt vorhanden
- [ ] Sensitive Dateien blockiert (.git, .env, etc.)
- [ ] CORS konfiguriert (falls APIs später genutzt)
- [ ] CSP Header für XSS-Schutz

### **Empfohlene Security Headers (Nginx)**
```nginx
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests; block-all-mixed-content" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
add_header Permissions-Policy "accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), gyroscope=(), hid=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), speaker-selection=(), usb=(), web-share=(), xr-spatial-tracking=()" always;
```

---

## ⚡ Performance Optimierungen

### **1. Asset Versioning**
```html
<!-- Alte Methode (nicht cachebar) -->
<link rel="stylesheet" href="style.css">

<!-- Neue Methode (mit Hash) -->
<link rel="stylesheet" href="style.css?v=1.2.0">
```

### **2. Minification**
```bash
# Optional: JavaScript minifizieren (falls nötig)
npx terser scripts/script.js -o scripts/script.min.js -c -m

# CSS minifizieren
npx cleancss style.css -o style.min.css
```

### **3. Image Optimization**
```bash
# Logo optimieren
imagemin images/ --out-dir=images/

# oder online: https://tinypng.com
```

### **4. Caching-Strategie**
```
Statische Assets:
  - Cache: 1 Jahr (Expires Header)
  - Versioning: URL mit Hash

HTML/Dynamic Content:
  - Cache: 1 Stunde (short-term)
  - Must-revalidate: ja

Subsidy Data (JSON):
  - Cache: 7 Tage (infrequent updates)
  - revalidate on demand
```

---

## 🔄 CI/CD Setup (Optional)

### **GitHub Actions (kostenloses Deployment)**

**.github/workflows/deploy.yml**
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Validate Files
        run: |
          # Check JSON syntax
          python -m json.tool data/data.json > /dev/null
          python -m json.tool data/subsidies.json > /dev/null
          
          # Check HTML
          grep -r "<!DOCTYPE html>" index.html || exit 1
      
      - name: Run Tests
        run: |
          # Falls Node.js Tests: npm test
          echo "Tests would run here"
      
      - name: Deploy
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
```

### **GitLab CI (ähnlich)**
**.gitlab-ci.yml**
```yaml
pages:
  stage: deploy
  script:
    - echo "Validating..."
  artifacts:
    paths:
      - .
  only:
    - main
```

---

## 📊 Monitoring & Analytics

### **Option 1: Google Analytics**
```html
<!-- In index.html hinzufügen -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_ID');
</script>
```

### **Option 2: Matomo (Self-Hosted, GDPR-freundlich)**
```html
<script>
  var _paq = window._paq = window._paq || [];
  _paq.push(['setUserId', '{{USER_ID}}']);
  _paq.push(['trackPageView']);
  (function() {
    var u="https://matomo.example.com/";
    _paq.push(['setTrackerUrl', u+'matomo.php']);
    _paq.push(['setSiteId', '1']);
    var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
    g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
  })();
</script>
```

---

## 🧪 Deployment Checklist

### **Vor Deployment**
- [ ] Alle Tests laufen lokal durch (`runAllTests()`)
- [ ] Keine Console-Fehler in DevTools
- [ ] Responsive Layout auf allen Breakpoints getestet
- [ ] Accessibility mit Screen Reader getestet
- [ ] Performance mit Lighthouse geprüft (Score >90)
- [ ] JSON-Dateien validiert
- [ ] Keine Hardcoded URLs (nur relative Pfade)
- [ ] .env Secrets nicht committet (.gitignore)

### **Nach Deployment**
- [ ] HTTPS funktioniert
- [ ] Homepage lädt ohne Fehler
- [ ] Formular funktioniert
- [ ] Charts rendern korrekt
- [ ] PDF-Export funktioniert
- [ ] Subsidies laden (wenn sichtbar)
- [ ] Monitoring aktiv
- [ ] Error-Logging konfiguriert

---

## 🐛 Troubleshooting

### **Problem: Charts laden nicht**
```javascript
// In DevTools Console:
console.log(window.Chart);  // Sollte nicht undefined sein
console.log(chartColors);   // Sollte Farbobjekt sein
```

**Lösung:** 
- Chart.js Library importieren prüfen
- `data/data.json` Path korrekt?

### **Problem: Subsidies erscheinen nicht**
```javascript
// In DevTools Console:
lazySubsidyLoader.load().then(d => console.log(d));
```

**Lösung:**
- Scroll zu Results-Container (triggert IntersectionObserver)
- `data/subsidies.json` exists?

### **Problem: localStorage funktioniert nicht**
```javascript
// In DevTools Console:
localStorage.setItem('test', 'value');
localStorage.getItem('test');
```

**Lösung:**
- Private Browsing Mode? → localStorage deaktiviert
- HTTPS erforderlich (lokal http OK)
- Storage Quota überschritten?

### **Problem: PDF Export funktioniert nicht**
```javascript
// In DevTools Console:
console.log(html2pdf);  // Sollte Objekt sein
```

**Lösung:**
- html2pdf Library loaded?
- Canvas rendering fehlgeschlagen?
- Browser-Speicher voll?

---

## 📈 Skalierung für höheres Traffic

### **Level 1: Basic Caching (kostenlos)**
```nginx
# browser cache
expires 1y;
```

### **Level 2: CDN (Cloudflare, 10 USD/Monat)**
```bash
# Nur Domain pointing → Cloudflare nameservers
# Automatic caching, DDoS protection, analytics
```

### **Level 3: Advanced Caching (Redis, 20+ USD)**
```nginx
# Server-side result caching
# db.energyplanning.calculations = cache
```

### **Level 4: Geographic Distribution (50+ USD)**
```bash
# Multi-region deployment
# Europe: Netlify
# Asia: Vercel
# Americas: AWS
```

---

## 📝 Versionierung & Releases

### **Semantic Versioning (semver)**
```
v1.3.0
  ↑ Major: Breaking changes
    ↑ Minor: New features
      ↑ Patch: Bug fixes
```

### **Release Process**
```bash
# 1. Bump version in CHANGELOG.md + package.json (falls vorhanden)
git tag -a v1.3.0 -m "Release version 1.3.0"
git push origin v1.3.0

# 2. GitHub → Releases → Draft new release
# 3. Select tag v1.3.0
# 4. Publish
```

---

## 🔄 Update & Maintenance

### **Monatlich**
- [ ] Subsidy-Daten aktualisieren (KfW, BAFA)
- [ ] Security Updates prüfen

### **Quartal**
- [ ] Performance-Metriken überprüfen
- [ ] User Feedback analysieren
- [ ] Dependency-Updates (Chart.js, html2pdf)

### **Jährlich**
- [ ] Code-Audit durchführen
- [ ] Accessibility re-test
- [ ] Kostenmodelle überprüfen
- [ ] Technologie-Update planen

---

## 🆘 Support & Kontakt

- **Issues:** GitHub Issues
- **Email:** support@example.com
- **Dokumentation:** `/docs/` Verzeichnis
- **Forum:** (falls vorhanden)

---

## 📜 Lizenz & Attribution

```
License: MIT (siehe LICENSE Datei)

Dependencies:
- Chart.js (MIT)
- html2pdf (MIT)
```
