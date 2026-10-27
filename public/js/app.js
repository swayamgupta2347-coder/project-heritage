// ==========================================================================
// Main Application Controller & Dynamic Router
// Manages global state, client routing, user passport, and UI translations
// ==========================================================================

const App = {
  state: {
    user: null,
    token: localStorage.getItem('heritage_token') || null,
    routes: [],
    landmarks: [],
    translations: {},
    currentLang: localStorage.getItem('heritage_lang') || 'en',
    activeRouteId: 'route-rome-imperial',
    activeLandmarkId: 'landmark-colosseum',
    passport: null
  },

  async init() {
    this.setupAudioContext();
    await this.loadTranslations(this.state.currentLang);
    await this.checkAuthSession();
    await this.fetchRoutes();
    await this.fetchLandmarks();

    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();

    // Auto-login tourist by default if no user so platform is instantly usable without barriers
    if (!this.state.user) {
      await this.quickDemoLogin('tourist', true);
    }

    AudioGuide.init();
    if (window.AgenticAI && typeof window.AgenticAI.init === 'function') {
      window.AgenticAI.init();
    }
  },

  setupAudioContext() {
    this.audioCtx = null;
  },

  playAudioChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
  },

  // Language & Translation Engine
  async loadTranslations(lang) {
    try {
      const res = await fetch(`/api/translations/${lang}`);
      if (res.ok) {
        this.state.translations = await res.json();
      } else {
        this.state.translations = window.SEED_CACHE?.translations?.[lang] || window.SEED_CACHE?.translations?.['en'] || {};
      }
    } catch (e) {
      this.state.translations = window.SEED_CACHE?.translations?.[lang] || window.SEED_CACHE?.translations?.['en'] || {};
    }
    this.state.currentLang = lang;
    localStorage.setItem('heritage_lang', lang);
    const codeEl = document.getElementById('current-lang-code');
    if (codeEl) codeEl.textContent = lang.toUpperCase();
    this.applyTranslations();
  },

  async changeLanguage(lang) {
    await this.loadTranslations(lang);
    this.toggleLangMenu();
    this.showToast(`Language set to: ${lang.toUpperCase()}`);
    this.handleRoute(); // re-render active view
  },

  applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (this.state.translations[key]) {
        el.textContent = this.state.translations[key];
      }
    });
  },

  toggleLangMenu(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('lang-dropdown');
    if (dropdown) dropdown.classList.toggle('show');
  },

  // Auth & Session
  async checkAuthSession() {
    if (!this.state.token) {
      this.renderUserBadge();
      return;
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${this.state.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        this.state.user = data.user;
      } else {
        this.logout(false);
      }
    } catch (e) {
      console.warn('Session verification error:', e);
    }
    this.renderUserBadge();
  },

  renderUserBadge() {
    const area = document.getElementById('user-profile-area');
    if (!area) return;

    if (this.state.user) {
      const u = this.state.user;
      area.innerHTML = `
        <div class="user-badge" onclick="App.navigate('passport')" title="View Passport">
          <div class="user-avatar">${u.role === 'admin' ? '🏛️' : '🚶'}</div>
          <div class="user-info-text">
            <span class="user-name">${u.name}</span>
            <span class="user-role-tag">${u.role}</span>
          </div>
          <button style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:12px; margin-left:4px;" onclick="event.stopPropagation(); App.logout();" title="Logout">✕</button>
        </div>
      `;
    } else {
      area.innerHTML = `
        <button class="btn btn-outline-gold btn-sm" onclick="App.openAuthModal()">
          🔑 Sign In
        </button>
      `;
    }
  },

  async quickDemoLogin(role, silent = false) {
    const email = role === 'admin' ? 'admin@heritage.org' : 'tourist@heritage.org';
    const password = role === 'admin' ? 'admin123' : 'tourist123';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        const data = await res.json();
        this.state.token = data.token;
        this.state.user = data.user;
        localStorage.setItem('heritage_token', data.token);
        this.renderUserBadge();
        this.closeAuthModal();
        if (!silent) {
          this.showToast(`✨ Logged in as: ${data.user.name} (${data.user.role.toUpperCase()})`);
        }
        return;
      }
    } catch (err) {
      // Server unreachable, use static offline fallback
    }

    const mockUser = role === 'admin'
      ? { id: "user-admin-1", email: "admin@heritage.org", name: "Dr. Alistair Finch", role: "admin" }
      : { id: "user-tourist-1", email: "tourist@heritage.org", name: "Marco Rossi", role: "tourist" };
    this.state.token = 'demo-token-' + role;
    this.state.user = mockUser;
    localStorage.setItem('heritage_token', this.state.token);
    this.renderUserBadge();
    this.closeAuthModal();
    if (!silent) {
      this.showToast(`✨ Logged in as: ${mockUser.name} (${mockUser.role.toUpperCase()})`);
    }
  },

  async handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const isRegister = document.getElementById('tab-register').classList.contains('active');

    const errBox = document.getElementById('auth-error-msg');
    errBox.classList.add('hidden');

    try {
      const url = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = { email, password };
      if (isRegister) {
        body.name = document.getElementById('auth-name').value;
        body.role = document.getElementById('auth-role').value;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (res.ok) {
        this.state.token = data.token;
        this.state.user = data.user;
        localStorage.setItem('heritage_token', data.token);
        this.renderUserBadge();
        this.closeAuthModal();
        this.showToast(`Welcome, ${data.user.name}!`);
      } else {
        errBox.textContent = data.error || 'Authentication failed';
        errBox.classList.remove('hidden');
      }
    } catch (err) {
      errBox.textContent = 'Server connection error';
      errBox.classList.remove('hidden');
    }
  },

  logout(showMsg = true) {
    this.state.token = null;
    this.state.user = null;
    localStorage.removeItem('heritage_token');
    this.renderUserBadge();
    if (showMsg) this.showToast('Logged out');
    this.navigate('routes');
  },

  // Data Fetching
  async fetchRoutes() {
    try {
      const res = await fetch('/api/routes');
      const raw = res.ok ? await res.json() : (window.SEED_CACHE?.routes || []);
      // Strict de-duplication by id and title
      const seen = new Set();
      this.state.routes = raw.filter(r => {
        if (!r || !r.id || seen.has(r.id) || seen.has(r.title)) return false;
        seen.add(r.id);
        seen.add(r.title);
        return true;
      });
    } catch (e) {
      this.state.routes = window.SEED_CACHE?.routes || [];
    }
  },

  async fetchLandmarks() {
    try {
      const res = await fetch('/api/landmarks');
      const raw = res.ok ? await res.json() : (window.SEED_CACHE?.landmarks || []);
      // Strict de-duplication by id and name
      const seen = new Set();
      this.state.landmarks = raw.filter(l => {
        if (!l || !l.id || seen.has(l.id) || seen.has(l.name)) return false;
        seen.add(l.id);
        seen.add(l.name);
        return true;
      });
    } catch (e) {
      this.state.landmarks = window.SEED_CACHE?.landmarks || [];
    }
  },

  // Dynamic Routing
  navigate(routePath) {
    window.location.hash = `#/${routePath}`;
  },

  handleRoute() {
    const hash = window.location.hash.replace(/^#\/?/, '') || 'routes';
    const parts = hash.split('/');
    const mainPage = parts[0];
    const param = parts[1];

    // Highlight nav link
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === mainPage);
    });

    const content = document.getElementById('app-content');
    if (!content) return;

    if (mainPage === 'routes') {
      this.renderRoutesPage(content);
    } else if (mainPage === 'map') {
      this.renderMapPage(content, param);
    } else if (mainPage === 'landmark') {
      this.renderLandmarkPage(content, param);
    } else if (mainPage === 'ar') {
      this.renderARPage(content, param);
    } else if (mainPage === 'passport') {
      this.renderPassportPage(content);
    } else if (mainPage === 'analytics') {
      this.renderAnalyticsPage(content);
    } else if (mainPage === 'admin') {
      this.renderAdminPage(content);
    } else {
      this.renderRoutesPage(content);
    }

    this.applyTranslations();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // ==========================================
  // PAGE 1: ROUTE SELECTION & DISCOVERY
  // ==========================================
  renderRoutesPage(container) {
    container.innerHTML = `
      <div class="page-header">
        <h2 class="page-title">Digital Heritage Routes</h2>
        <p class="page-description">
          Explore interactive walking corridors across ancient civilizations. Experience location-triggered spatial audio, 3D monument reconstructions, and cultural storytelling along historical pathways.
        </p>
      </div>

      <!-- Discovery Toolbar -->
      <div class="routes-toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" class="search-input" id="route-search" placeholder="Search corridors, UNESCO sites, dynasties..." oninput="App.filterRoutes()">
        </div>
        <div class="filter-pills">
          <button class="pill-btn active" data-city="all" onclick="App.filterByCity('all')">All Regions</button>
          <button class="pill-btn" data-city="Rome" onclick="App.filterByCity('Rome')">Rome (Italy)</button>
          <button class="pill-btn" data-city="Delhi" onclick="App.filterByCity('Delhi')">Delhi & Agra (India)</button>
          <button class="pill-btn" data-city="Kyoto" onclick="App.filterByCity('Kyoto')">Kyoto (Japan)</button>
          <button class="pill-btn" data-city="Cairo" onclick="App.filterByCity('Cairo')">Cairo & Giza (Egypt)</button>
          <button class="pill-btn" data-city="Athens" onclick="App.filterByCity('Athens')">Athens (Greece)</button>
          <button class="pill-btn" data-city="Cusco" onclick="App.filterByCity('Cusco')">Machu Picchu (Peru)</button>
        </div>
      </div>

      <!-- Routes Cards Grid -->
      <div class="routes-grid" id="routes-grid">
        ${this.state.routes.map(r => this.renderRouteCard(r)).join('')}
      </div>
    `;
  },

  renderRouteCard(r) {
    return `
      <div class="route-card" data-city="${r.city}" data-title="${r.title.toLowerCase()}">
        <div class="route-card-media">
          <img src="${r.coverImage}" class="route-card-img" alt="${r.title}">
          <div class="route-card-overlay">
            <div class="route-badge-row">
              <span class="badge-unesco">🏛️ UNESCO HERITAGE</span>
              <span class="route-rating">★ ${r.rating || 4.9}</span>
            </div>
            <div class="route-meta-chips">
              <span class="meta-chip">📏 ${r.distanceKm} km</span>
              <span class="meta-chip">⏱️ ${r.durationMins} mins</span>
              <span class="meta-chip">🚶 ${r.difficulty}</span>
            </div>
          </div>
        </div>

        <div class="route-card-body">
          <h3 class="route-title">${r.title}</h3>
          <div class="route-location">📍 ${r.city}, ${r.country} • ${r.region || ''}</div>
          <p class="route-desc">${r.description}</p>

          <div class="route-landmarks-preview">
            <span class="preview-label">Corridor Waypoints (${r.landmarks?.length || 0} stops):</span>
            <div class="preview-dots">
              ${(r.landmarksPreview || []).map(lp => `
                <span class="preview-dot-item" title="${lp.name}">${lp.name}</span>
              `).join('')}
            </div>
          </div>

          <div class="route-card-footer">
            <button class="btn btn-primary" style="flex:1;" onclick="App.navigate('map/${r.id}')">
              📍 View Route Map
            </button>
            <button class="btn btn-secondary" onclick="App.navigate('ar/${r.landmarks?.[0] || 'landmark-colosseum'}')">
              ✨ AR View
            </button>
          </div>
        </div>
      </div>
    `;
  },

  filterByCity(city) {
    document.querySelectorAll('.pill-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.city === city);
    });
    const cards = document.querySelectorAll('.route-card');
    cards.forEach(card => {
      if (city === 'all' || card.dataset.city.includes(city)) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  },

  filterRoutes() {
    const q = (document.getElementById('route-search')?.value || '').toLowerCase();
    const cards = document.querySelectorAll('.route-card');
    cards.forEach(card => {
      const match = card.dataset.title.includes(q) || card.textContent.toLowerCase().includes(q);
      card.style.display = match ? 'flex' : 'none';
    });
  },

  // ==========================================
  // PAGE 2: INTERACTIVE ROUTE MAP & GPS SIMULATOR
  // ==========================================
  renderMapPage(container, routeId) {
    const activeId = routeId || this.state.activeRouteId || this.state.routes[0]?.id;
    const route = this.state.routes.find(r => r.id === activeId) || this.state.routes[0];
    const routeLandmarks = this.state.landmarks.filter(l => route.landmarks?.includes(l.id));

    this.state.activeRouteId = route.id;

    container.innerHTML = `
      <div class="page-header" style="margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 class="page-title">${route.title}</h2>
            <p class="page-description">Interactive GPS Walking Route • Proximity geofencing unlocks AR storytelling when within 200m</p>
          </div>
          <div style="display:flex; gap:10px;">
            <select class="form-input" style="width:240px; padding:8px 12px;" onchange="App.navigate('map/' + this.value)">
              ${this.state.routes.map(r => `
                <option value="${r.id}" ${r.id === route.id ? 'selected' : ''}>${r.title}</option>
              `).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="map-view-container">
        <!-- Google Maps Interactive Viewport -->
        <div class="map-canvas-wrapper">
          <div class="map-hud-top">
            <div class="hud-route-badge">
              <span>🗺️</span>
              <span class="hud-route-name">${route.city}: ${route.landmarks?.length || 0} Historical Stops (Google Maps)</span>
            </div>
            <div class="map-layer-controls">
              <button class="layer-btn active" data-style="m" onclick="RouteMap.setMapStyle('m')">🗺️ Google Map</button>
              <button class="layer-btn" data-style="k" onclick="RouteMap.setMapStyle('k')">🛰️ Satellite (LiDAR)</button>
              <button class="layer-btn" data-style="p" onclick="RouteMap.setMapStyle('p')">⛰️ Terrain</button>
              <button class="layer-btn" data-style="streetview" onclick="RouteMap.setMapStyle('streetview')">👁️ Street View 360°</button>
              <button class="layer-btn btn-agentic-glow" id="map-ai-optimize-btn" onclick="RouteMap.toggleAiOptimization()">
                <span>🍓</span> Strawberry Smart Path
              </button>
            </div>
          </div>

          <div id="map-ai-banner" class="map-ai-banner hidden"></div>
          
          <div id="google-map-container" class="google-map-container">
            <iframe id="google-map-iframe" class="google-map-frame" src="" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
            <div id="google-map-pins-bar" class="google-map-pins-bar"></div>
          </div>

          <!-- Telemetry HUD Bottom -->
          <div class="map-telemetry-bottom">
            <div class="walker-simulator-panel">
              <div class="walker-status">
                <span class="walker-label">GPS Geofence Proximity:</span>
                <span class="walker-val" id="walker-dist-val">Calculating proximity...</span>
              </div>
              <button class="btn btn-primary btn-sm" id="walker-toggle-btn" onclick="RouteMap.toggleWalkerSimulation()">
                🚶 Simulate GPS Walker
              </button>
            </div>

            <div style="pointer-events:auto; display:flex; gap:8px;">
              <button class="btn btn-primary btn-sm" onclick="RouteMap.openInGoogleMaps()">
                🚶 Google Maps Directions
              </button>
              <button class="btn btn-secondary btn-sm" onclick="RouteMap.fitRouteBounds()">Reset View</button>
            </div>
          </div>
        </div>

        <!-- Sidebar Waypoints & Selected Landmark Card -->
        <div class="map-sidebar">
          <div id="selected-landmark-card">
            <!-- Rendered by RouteMap.updateSidebarCard -->
          </div>

          <!-- Elevation Profile SVG -->
          <div class="elevation-profile-box">
            <div class="elevation-title">
              <span>Trail Elevation Profile</span>
              <span style="font-family:var(--font-mono); color:var(--gold-primary);">Total Ascent: 42m</span>
            </div>
            <svg class="elevation-svg" viewBox="0 0 300 60">
              <path d="M 0 50 Q 75 20, 150 35 T 300 15 L 300 60 L 0 60 Z" fill="rgba(229, 184, 66, 0.15)"/>
              <path d="M 0 50 Q 75 20, 150 35 T 300 15" fill="none" stroke="#E5B842" stroke-width="2.5"/>
              <circle cx="75" cy="27" r="4" fill="#00F2FE"/>
              <circle cx="150" cy="35" r="4" fill="#E5B842"/>
              <circle cx="225" cy="25" r="4" fill="#E5B842"/>
            </svg>
          </div>

          <h4 style="font-family:var(--font-serif); font-size:15px; color:#FFF;">Route Waypoints</h4>
          <div class="landmark-waypoint-list">
            ${routeLandmarks.map((lm, idx) => `
              <div class="waypoint-item ${lm.isUnlocked ? 'unlocked' : ''}" onclick="RouteMap.selectLandmark(App.state.landmarks.find(l => l.id === '${lm.id}'))">
                <div class="waypoint-num">${idx + 1}</div>
                <div class="waypoint-info">
                  <div class="waypoint-title">${lm.name}</div>
                  <div class="waypoint-status in-range">
                    <span>${lm.yearBuilt}</span> • <span>${lm.elevation}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      RouteMap.init('google-map-container', route, routeLandmarks);
    }, 50);
  },

  // ==========================================
  // PAGE 3: LANDMARK DETAIL & STORYTELLING
  // ==========================================
  renderLandmarkPage(container, landmarkId) {
    const id = landmarkId || this.state.activeLandmarkId;
    const lm = this.state.landmarks.find(l => l.id === id) || this.state.landmarks[0];
    if (!lm) return;

    this.state.activeLandmarkId = lm.id;
    const isFav = this.state.user?.favorites?.includes(lm.id);
    const isVisited = this.state.user?.visitedLandmarks?.includes(lm.id);

    container.innerHTML = `
      <!-- Hero Banner -->
      <div class="landmark-hero-banner">
        <img src="${lm.thumbnail}" class="landmark-hero-img" alt="${lm.name}">
        <div class="landmark-hero-gradient">
          <div class="landmark-hero-meta">
            <span class="tag-pill">${lm.yearBuilt}</span>
            <span class="tag-pill" style="border-color:var(--lidar-cyan); color:var(--lidar-cyan);">3D LiDAR SCANNED</span>
            <span class="meta-chip">GPS: ${lm.coordinates[0].toFixed(4)}°N, ${lm.coordinates[1].toFixed(4)}°E</span>
          </div>
          <h1 class="landmark-title">${lm.name}</h1>
          <div class="landmark-subtitle">${lm.nativeName} • ${lm.era}</div>

          <div class="landmark-actions-bar">
            <button class="btn btn-primary" onclick="AudioGuide.loadTrack('${lm.id}')">
              🎧 Play Audio Guide (izi.TRAVEL)
            </button>
            <button class="btn btn-lidar" onclick="App.navigate('ar/${lm.id}')">
              ✨ Open WebAR & 3D Model
            </button>
            <button class="btn btn-secondary" onclick="QRScanner.showMonumentPlacard('${lm.id}')">
              📷 View Physical QR Plaque
            </button>
            <button class="btn ${isVisited ? 'btn-secondary' : 'btn-outline-gold'}" onclick="App.stampPassport('${lm.id}')">
              ${isVisited ? '✓ Stamped in Passport' : '🛂 Stamp Passport'}
            </button>
            <button class="btn btn-secondary" onclick="App.toggleFavorite('${lm.id}')">
              ${isFav ? '★ Bookmarked' : '☆ Bookmark'}
            </button>
            <button class="btn btn-secondary btn-agentic-glow" onclick="AgenticAI.askForLandmark('${lm.id}', 'engineering')">
              🍓 Strawberry Scholar
            </button>
            <button class="btn btn-secondary" onclick="AgenticAI.runOpenClaw('${lm.id}', 'landmark-openclaw-area')">
              🦅 Open Claw Research
            </button>
            <button class="btn btn-secondary" onclick="App.shareLandmark('${lm.id}')">
              🔗 Share Story
            </button>
          </div>
        </div>
      </div>

      <!-- Storytelling Grid -->
      <div class="story-layout">
        <!-- Main Column -->
        <div class="story-main-col">
          <div id="landmark-openclaw-area"></div>
          <!-- Comprehensive Narrative Card -->
          <div class="story-card">
            <h3 class="section-title">Architectural & Historical Chronicle</h3>
            <p class="story-prose">${lm.historicalNarrative}</p>

            <!-- Then & Now Reconstruction Slider -->
            <h4 style="font-family:var(--font-serif); font-size:16px; margin:24px 0 12px 0; color:var(--text-gold);">
              Then & Now: Archival State vs Contemporary Conservation
            </h4>
            <div class="reconstruction-slider-box" id="recon-box">
              <img src="${lm.thumbnail}" class="reconstruction-img" alt="Current state">
              <div class="reconstruction-overlay" id="recon-overlay">
                <img src="${lm.archivalImage}" class="reconstruction-img" alt="Archival antiquity" style="width:100%; height:100%; object-fit:cover;">
              </div>
              <div class="reconstruction-slider-bar" id="recon-bar">
                <div class="slider-handle">↔</div>
              </div>
              <span class="slider-label-left">ARCHIVAL ANTIQUITY</span>
              <span class="slider-label-right">CONTEMPORARY CONSERVATION</span>
            </div>
          </div>

          <!-- Interactive Historical Timeline -->
          <div class="story-card">
            <h3 class="section-title">Evolutionary Timeline & Milestones</h3>
            <div class="timeline-track">
              <div class="timeline-line"></div>
              <div class="timeline-nodes">
                ${(lm.timeline || []).map(node => `
                  <div class="timeline-node">
                    <div class="timeline-dot"></div>
                    <div>
                      <div class="timeline-year">${node.year}</div>
                      <h4 class="timeline-heading">${node.title}</h4>
                      <p class="timeline-desc">${node.description}</p>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar Column -->
        <div class="story-sidebar-col">
          <!-- Character Storytelling Box -->
          <div class="character-dialogue-box">
            <div class="character-header">
              <div class="character-avatar-large">${lm.character?.avatar || '🏛️'}</div>
              <div>
                <h4 style="font-size:17px; font-weight:700; color:#FFF;">${lm.character?.name || 'Historical Voice'}</h4>
                <span style="font-size:12px; color:var(--gold-primary);">${lm.character?.title || 'Historical Figure'}</span>
              </div>
            </div>

            <div class="character-quote-speech">
              "${lm.character?.introQuote || 'Hear the chronicle of this sacred sanctuary.'}"
            </div>

            <h5 style="font-size:12px; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.5px;">Ask the Historical Figure:</h5>
            <div class="dialogue-questions-list">
              ${(lm.character?.dialogues || []).map((d, idx) => `
                <button class="dialogue-question-btn" onclick="App.askCharacterQuestion('${lm.id}', ${idx})">
                  <span>${d.question}</span>
                  <span>💬</span>
                </button>
              `).join('')}
            </div>

            <div id="character-response-area"></div>
          </div>

          <!-- Embedded Strawberry AI Scholarly Inquiry Console -->
          <div class="story-card" style="border:1px solid rgba(255,51,102,0.3); background:linear-gradient(135deg, rgba(20,26,36,0.95), rgba(30,15,22,0.9)); margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:22px;">🍓</span>
                <h4 style="font-size:15px; font-weight:700; color:#FFF; margin:0;">Strawberry AI Scholar</h4>
              </div>
              <span class="badge-strawberry">o-series CoT</span>
            </div>
            <p style="font-size:12px; color:var(--text-secondary); margin-bottom:12px; line-height:1.45;">
              Inquire into structural physics, epigraphic records, or CyArk 3D laser-scan analysis with deep multi-step reasoning.
            </p>

            <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:12px;">
              <button class="dialogue-question-btn" style="border-color:rgba(255,51,102,0.35); text-align:left;" onclick="AgenticAI.askForLandmark('${lm.id}', 'engineering')">
                <span>📐 Structural & Seismic Mechanics</span>
                <span>🍓</span>
              </button>
              <button class="dialogue-question-btn" style="border-color:rgba(255,51,102,0.35); text-align:left;" onclick="AgenticAI.askForLandmark('${lm.id}', 'epigraphy')">
                <span>📜 Epigraphic & Textual Records</span>
                <span>🍓</span>
              </button>
              <button class="dialogue-question-btn" style="border-color:rgba(255,51,102,0.35); text-align:left;" onclick="AgenticAI.askForLandmark('${lm.id}', 'lidar')">
                <span>🦅 CyArk 3D LiDAR Comparison</span>
                <span>🍓</span>
              </button>
            </div>

            <button class="btn btn-primary btn-block btn-sm btn-agentic-glow" onclick="AgenticAI.toggleDrawer(true)">
              💬 Open Full Interactive Scholar Chat
            </button>
          </div>

          <!-- Cultural Insights -->
          <div class="story-card">
            <h4 class="section-title" style="font-size:18px;">Archaeological Highlights</h4>
            ${(lm.culturalInsights || []).map(ins => `
              <div class="insight-card">
                <span class="insight-icon">◈</span>
                <span>${ins}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    this.setupReconstructionSlider();
    this.trackEvent('landmark_view', lm.id);
  },

  setupReconstructionSlider() {
    const box = document.getElementById('recon-box');
    const overlay = document.getElementById('recon-overlay');
    const bar = document.getElementById('recon-bar');
    if (!box || !overlay || !bar) return;

    let isSliding = false;
    const moveSlider = (clientX) => {
      const rect = box.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const pct = (x / rect.width) * 100;
      overlay.style.width = `${pct}%`;
      bar.style.left = `${pct}%`;
    };

    bar.addEventListener('mousedown', () => isSliding = true);
    window.addEventListener('mouseup', () => isSliding = false);
    window.addEventListener('mousemove', (e) => {
      if (isSliding) moveSlider(e.clientX);
    });

    bar.addEventListener('touchstart', () => isSliding = true);
    window.addEventListener('touchend', () => isSliding = false);
    window.addEventListener('touchmove', (e) => {
      if (isSliding && e.touches[0]) moveSlider(e.touches[0].clientX);
    });
  },

  askCharacterQuestion(landmarkId, dialogueIdx) {
    const lm = this.state.landmarks.find(l => l.id === landmarkId);
    if (!lm || !lm.character?.dialogues?.[dialogueIdx]) return;

    const d = lm.character.dialogues[dialogueIdx];
    const area = document.getElementById('character-response-area');
    if (!area) return;

    area.innerHTML = `
      <div class="dialogue-response-bubble">
        <strong style="color:var(--gold-primary); display:block; margin-bottom:4px;">${lm.character.name}:</strong>
        "${d.answer}"
      </div>
    `;

    // Voiced response
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(d.answer);
      utt.pitch = 0.95;
      utt.rate = 1.0;
      window.speechSynthesis.speak(utt);
    }
  },

  // ==========================================
  // PAGE 4: WEBAR & 3D VISUALIZATION EXPERIENCE
  // ==========================================
  renderARPage(container, landmarkId) {
    const id = landmarkId || this.state.activeLandmarkId || 'landmark-colosseum';
    const lm = this.state.landmarks.find(l => l.id === id) || this.state.landmarks[0];
    this.state.activeLandmarkId = lm.id;

    container.innerHTML = `
      <div class="page-header" style="margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 class="page-title">WebAR 3D Storytelling Experience</h2>
            <p class="page-description">Interactive 3D Monument Hologram • CyArk LiDAR point clouds, structural layer dissection & live camera projection</p>
          </div>
          <div style="display:flex; gap:10px;">
            <select class="form-input" style="width:240px; padding:8px 12px;" onchange="App.navigate('ar/' + this.value)">
              ${this.state.landmarks.map(l => `
                <option value="${l.id}" ${l.id === lm.id ? 'selected' : ''}>${l.name}</option>
              `).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="ar-experience-container">
        <!-- 3D & AR Viewport Card -->
        <div class="ar-viewport-card">
          <!-- Background Camera Feed -->
          <video id="ar-camera-video" class="ar-camera-feed" autoplay playsinline muted style="display:none;"></video>
          <!-- Background Simulated Environment -->
          <div id="simulated-env" class="ar-simulated-env" style="background-image:url('${lm.thumbnail}');"></div>

          <!-- WebGL 3D Canvas -->
          <canvas id="webar-canvas" class="ar-webgl-canvas"></canvas>

          <!-- Top HUD -->
          <div class="ar-hud-top">
            <div class="ar-telemetry-badge">
              <span>●</span>
              <span>LiDAR TELEMETRY • ${lm.modelType.toUpperCase()} (4.2M PTS)</span>
            </div>
            <div class="ar-controls-top">
              <button class="btn btn-secondary btn-sm" onclick="WebAR.toggleCamera()" title="Switch Camera / Simulated Env">
                📷 Toggle Camera Feed
              </button>
            </div>
          </div>

          <!-- Center Viewfinder Reticle -->
          <div class="ar-hud-center-reticle">
            <div class="reticle-corner" style="top:0; left:0; border-top:2px solid #00F2FE; border-left:2px solid #00F2FE;"></div>
            <div class="reticle-corner" style="top:0; right:0; border-top:2px solid #00F2FE; border-right:2px solid #00F2FE;"></div>
            <div class="reticle-corner" style="bottom:0; left:0; border-bottom:2px solid #00F2FE; border-left:2px solid #00F2FE;"></div>
            <div class="reticle-corner" style="bottom:0; right:0; border-bottom:2px solid #00F2FE; border-right:2px solid #00F2FE;"></div>
          </div>

          <!-- Floating Character Hologram Voice -->
          <div class="ar-character-hologram">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <span style="font-size:20px;">${lm.character?.avatar || '🏛️'}</span>
              <strong style="font-size:13px; color:#FFF;">${lm.character?.name || 'Guide'}</strong>
            </div>
            <p style="font-size:12px; color:var(--text-gold); font-style:italic; line-height:1.4;">
              "${lm.character?.introQuote || 'Gaze into the stone.'}"
            </p>
          </div>

          <!-- Bottom HUD Controls -->
          <div class="ar-hud-bottom">
            <div class="ar-mode-toggles">
              <button class="ar-mode-btn active" data-mode="realistic" onclick="WebAR.setRenderMode('realistic')">Realistic 3D</button>
              <button class="ar-mode-btn" data-mode="lidar" onclick="WebAR.setRenderMode('lidar')">CyArk LiDAR</button>
              <button class="ar-mode-btn" data-mode="wireframe" onclick="WebAR.setRenderMode('wireframe')">Blueprint X-Ray</button>
            </div>

            <button class="ar-snapshot-btn" onclick="WebAR.captureSnapshot()" title="Capture AR Archival Snapshot">
              📸
            </button>
          </div>
        </div>

        <!-- Right Controls Sidebar -->
        <div class="ar-sidebar">
          <div>
            <h3 style="font-family:var(--font-serif); font-size:18px; color:#FFF; margin-bottom:4px;">${lm.name}</h3>
            <span style="font-size:12px; color:var(--gold-primary); font-family:var(--font-mono);">${lm.yearBuilt} • ${lm.era}</span>
          </div>

          <!-- Structural Dissection Slider -->
          <div class="slider-group">
            <div class="slider-label">
              <span>Explode / Dissect Layers:</span>
              <span id="explode-val-txt" style="font-family:var(--font-mono);">0%</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" value="0" class="range-input" oninput="WebAR.setExplode(this.value); document.getElementById('explode-val-txt').textContent = Math.round(this.value * 100) + '%';">
          </div>

          <!-- Model Scale Slider -->
          <div class="slider-group">
            <div class="slider-label">
              <span>AR Projection Scale:</span>
              <span id="scale-val-txt" style="font-family:var(--font-mono);">1.0x</span>
            </div>
            <input type="range" min="0.5" max="2.0" step="0.1" value="1.0" class="range-input" oninput="WebAR.setScale(this.value); document.getElementById('scale-val-txt').textContent = this.value + 'x';">
          </div>

          <!-- Epoch Time-Travel Chrono-Slider -->
          <div class="slider-group">
            <div class="slider-label">
              <span>Time-Travel Epoch:</span>
              <span id="chrono-val" style="font-family:var(--font-mono); color:var(--gold-primary);">Modern Preserved State</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" value="0" class="range-input" oninput="WebAR.setChronoRatio(this.value)">
          </div>

          <!-- Interactive 3D Viewpoints -->
          <div style="margin: 14px 0;">
            <label style="display:block; font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Interactive 3D Camera Angles:</label>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
              <button class="btn btn-secondary btn-sm" onclick="WebAR.setViewpoint('front')">👁️ Front Facade</button>
              <button class="btn btn-secondary btn-sm" onclick="WebAR.setViewpoint('drone')">🦅 Aerial Drone</button>
              <button class="btn btn-secondary btn-sm" onclick="WebAR.setViewpoint('hypogeum')">🔍 Hypogeum</button>
              <button class="btn btn-secondary btn-sm" onclick="WebAR.setViewpoint('orbit')">🔄 360° Orbit</button>
            </div>
          </div>

          <!-- Simulated Background Selector -->
          <div class="form-group">
            <label style="font-size:12px;">Simulated Plaza Background:</label>
            <select class="form-input" style="font-size:13px;" onchange="WebAR.setSimulatedEnv(this.value)">
              <option value="forum">Roman Forum Antiquity Plaza</option>
              <option value="mughal">Mughal Charbagh Gardens</option>
              <option value="kyoto">Kyoto Sacred Mountain Cedar</option>
              <option value="giza">Giza Plateau Desert Dunes</option>
            </select>
          </div>

          <!-- Physical QR Code Scanner / Trigger Shelf -->
          <div class="qr-scanner-shelf">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="font-size:12.5px; color:#FFF;">Scan Physical QR Marker</strong>
              <span style="font-size:10px; color:var(--lidar-cyan); font-family:var(--font-mono);">READY</span>
            </div>
            <p style="font-size:11.5px; color:var(--text-muted); margin:4px 0 8px 0;">
              Point camera at physical monument placard or test instant simulated markers:
            </p>
            <div class="qr-test-tags">
              ${this.state.landmarks.slice(0, 4).map(l => `
                <button class="qr-pill" onclick="QRScanner.handleTriggerCode('${l.qrCode}')">
                  ${l.name.split(' ')[0]} QR
                </button>
              `).join('')}
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px;">
            <button class="btn btn-primary btn-sm" onclick="App.navigate('landmark/${lm.id}')">
              📖 View Landmark Story
            </button>
            <button class="btn btn-secondary btn-sm btn-agentic-glow" onclick="AgenticAI.askForLandmark('${lm.id}', 'physics')">
              🍓 Ask Strawberry Scholar
            </button>
            <button class="btn btn-secondary btn-sm" onclick="AudioGuide.loadTrack('${lm.id}')">
              🎧 Listen to Audio Guide
            </button>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      WebAR.init('webar-canvas', 'ar-camera-video');
      WebAR.setModel(lm.modelType);
    }, 50);

    this.trackEvent('ar_interaction', lm.id);
  },

  // ==========================================
  // PAGE 5: TOURIST PASSPORT & VISITED COLLECTION
  // ==========================================
  async renderPassportPage(container) {
    container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Opening Heritage Passport...</p></div>`;

    let passportData = null;
    if (this.state.token) {
      try {
        const res = await fetch('/api/user/passport', {
          headers: { 'Authorization': `Bearer ${this.state.token}` }
        });
        if (res.ok) passportData = await res.json();
      } catch (e) {}
    }

    if (!passportData) {
      // Offline fallback from local state
      const visited = this.state.user?.visitedLandmarks || [];
      const visitedLandmarks = this.state.landmarks.filter(l => visited.includes(l.id));
      passportData = {
        user: this.state.user || { name: 'Guest Explorer', role: 'tourist' },
        visitedCount: visitedLandmarks.length,
        totalLandmarks: this.state.landmarks.length,
        progressPercent: Math.round((visitedLandmarks.length / (this.state.landmarks.length || 1)) * 100),
        visited: visitedLandmarks,
        badges: [
          { id: '1', title: 'Heritage Initiate', icon: '🏛️', unlocked: visitedLandmarks.length >= 1, description: 'Visited first historical landmark' },
          { id: '2', title: 'Roman Antiquary', icon: '🛡️', unlocked: visitedLandmarks.some(l => l.routeId === 'route-rome-imperial'), description: 'Explored Imperial Rome' },
          { id: '3', title: 'Mughal Connoisseur', icon: '🕌', unlocked: visitedLandmarks.some(l => l.routeId === 'route-delhi-mughal'), description: 'Explored Mughal monuments' },
          { id: '4', title: 'Zen Pilgrim', icon: '⛩️', unlocked: visitedLandmarks.some(l => l.routeId === 'route-kyoto-zen'), description: 'Walked Kyoto temple paths' },
          { id: '5', title: 'Horizon Seeker', icon: '🏺', unlocked: visitedLandmarks.some(l => l.routeId === 'route-cairo-pharaohs'), description: 'Explored Egyptian pyramids' },
          { id: '6', title: 'Hellenic Philosopher', icon: '🏛️', unlocked: visitedLandmarks.some(l => l.routeId === 'route-athens-acropolis'), description: 'Walked the Sacred Rock of Athens' },
          { id: '7', title: 'Inca Cloud Sovereign', icon: '☀️', unlocked: visitedLandmarks.some(l => l.routeId === 'route-machu-picchu'), description: 'Scaled the heights of Machu Picchu' },
          { id: '8', title: 'Ancient Relic Hologram', icon: '💎', unlocked: visitedLandmarks.length >= 3, description: 'Unlocked 3D LiDAR Holographic Relic Seal' }
        ]
      };
    }

    container.innerHTML = `
      <div class="passport-container">
        <!-- Leather & Gold Foil Passport Booklet -->
        <div class="passport-booklet">
          <div class="passport-gold-crest">
            <div class="crest-left">
              <div class="crest-seal">👑</div>
              <div>
                <h2 class="passport-title">OFFICIAL HERITAGE PASSPORT</h2>
                <span class="passport-badge-count">
                  ISSUED TO: <strong>${passportData.user.name}</strong> • ${passportData.visitedCount} OF ${passportData.totalLandmarks} MONUMENTS VISITED (${passportData.progressPercent}%)
                </span>
              </div>
            </div>
            <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
              <span class="badge-unesco">UNESCO ACCREDITED</span>
              <button class="btn btn-outline-gold btn-sm" onclick="App.downloadCertificate()">
                🎓 Download UNESCO Certificate
              </button>
            </div>
          </div>

          <!-- Passport Progress Bar -->
          <div style="margin-bottom:28px;">
            <div style="display:flex; justify-content:space-between; font-size:12.5px; color:var(--text-secondary); margin-bottom:6px;">
              <span>World Heritage Route Completion Progress:</span>
              <strong style="color:var(--gold-primary); font-family:var(--font-mono);">${passportData.progressPercent}%</strong>
            </div>
            <div class="bar-track" style="height:12px;">
              <div class="bar-fill" style="width: ${passportData.progressPercent}%;"></div>
            </div>
          </div>

          <!-- Visited Stamp Seals Grid -->
          <h3 class="section-title" style="margin-bottom:20px;">Earned Monument Wax Seals</h3>
          <div class="passport-stamps-grid">
            ${this.state.landmarks.map(lm => {
              const isStamped = (passportData.visited || []).some(v => v.id === lm.id);
              return `
                <div class="passport-stamp-card ${isStamped ? 'visited' : ''}" onclick="App.navigate('landmark/${lm.id}')">
                  <div class="stamp-seal" style="${isStamped ? '' : 'filter:grayscale(1); opacity:0.3; border-style:dashed;'}">
                    ${lm.character?.avatar || '🏛️'}
                  </div>
                  <strong style="font-size:13.5px; color:#FFF;">${lm.name}</strong>
                  <span style="font-size:11px; color:var(--gold-primary);">${lm.yearBuilt}</span>
                  ${isStamped ?
                    `<span class="stamp-date">STAMPED • VISITED</span>` :
                    `<button class="btn btn-outline-gold btn-sm" onclick="event.stopPropagation(); App.stampPassport('${lm.id}')">Stamp Now</button>`
                  }
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Explorer Badges & Honors -->
        <div class="story-card">
          <h3 class="section-title">Heritage Badges & Achievements</h3>
          <div class="badges-grid">
            ${(passportData.badges || []).map(b => `
              <div class="badge-card ${b.unlocked ? '' : 'locked'}">
                <div class="badge-icon">${b.icon}</div>
                <div>
                  <h4 style="font-size:14px; font-weight:700; color:#FFF;">${b.title}</h4>
                  <p style="font-size:12px; color:var(--text-secondary);">${b.description}</p>
                  <span style="font-size:10.5px; font-weight:600; color:${b.unlocked ? 'var(--lidar-green)' : 'var(--text-muted)'};">
                    ${b.unlocked ? '✓ UNLOCKED' : '🔒 INCOMPLETE'}
                  </span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Strawberry AI Personalized Expedition Log -->
        <div class="story-card" style="margin-top:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:22px;">🍓</span>
              <h3 class="section-title" style="margin:0;">Strawberry AI Personalized Expedition Log</h3>
            </div>
            <span class="badge-agentic">SCHOLAR SYNTHESIS</span>
          </div>
          <p style="font-size:13.5px; color:var(--text-secondary); line-height:1.6;">
            ${passportData.visitedCount > 0
              ? `Scholarly Expedition Assessment for <strong>${passportData.user.name}</strong>: Having stamped ${passportData.visitedCount} world heritage landmarks (${passportData.visited.map(v => v.name).join(', ')}), you have demonstrated deep curatorial immersion across ancient architectural engineering, epigraphic chronologies, and CyArk 3D laser documentation.`
              : `Embark upon your first heritage corridor to generate an AI-synthesized scholarly expedition chronicle signed by the virtual Lead Curator.`
            }
          </p>
        </div>
      </div>
    `;
  },

  async stampPassport(landmarkId) {
    if (!this.state.token) {
      await this.quickDemoLogin('tourist');
    }

    try {
      const res = await fetch(`/api/landmarks/${landmarkId}/visit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.state.token}` }
      });
      const data = await res.json();
      if (res.ok) {
        if (!this.state.user.visitedLandmarks.includes(landmarkId)) {
          this.state.user.visitedLandmarks.push(landmarkId);
        }
        this.playAudioChime();
        this.showToast(`🎉 Passport Stamped for ${data.stampedLandmark?.name}!`);
        if (window.location.hash.includes('passport')) {
          this.renderPassportPage(document.getElementById('app-content'));
        }
      }
    } catch (e) {
      console.error(e);
    }
  },

  async toggleFavorite(landmarkId) {
    if (!this.state.token) {
      await this.quickDemoLogin('tourist');
    }

    try {
      const res = await fetch(`/api/landmarks/${landmarkId}/favorite`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.state.token}` }
      });
      const data = await res.json();
      if (res.ok) {
        this.state.user.favorites = data.favorites;
        this.showToast(data.isFavorite ? '★ Added to bookmarks' : 'Removed from bookmarks');
        if (window.location.hash.includes('landmark')) {
          this.renderLandmarkPage(document.getElementById('app-content'), landmarkId);
        }
      }
    } catch (e) {
      console.error(e);
    }
  },

  // ==========================================
  // PAGE 6: VISITOR ANALYTICS DASHBOARD
  // ==========================================
  renderAnalyticsPage(container) {
    Analytics.renderView(container);
  },

  // ==========================================
  // PAGE 7: ADMIN CONTENT MANAGEMENT PANEL
  // ==========================================
  renderAdminPage(container) {
    // If not admin, offer one-click admin sign in
    if (!this.state.user || this.state.user.role !== 'admin') {
      container.innerHTML = `
        <div style="max-width:600px; margin:60px auto; text-align:center; background:var(--card-bg); border:1px solid var(--card-border); padding:40px; border-radius:18px;">
          <div style="font-size:48px; margin-bottom:16px;">🏛️</div>
          <h2 style="font-family:var(--font-serif); font-size:26px; color:#FFF; margin-bottom:12px;">Curator & Admin Panel</h2>
          <p style="font-size:14.5px; color:var(--text-secondary); margin-bottom:24px;">
            Content Management privileges are restricted to Heritage Curators and Documentation Leads. Click below to sign in as Chief Curator Dr. Finch.
          </p>
          <button class="btn btn-primary" onclick="App.quickDemoLogin('admin')">
            🏛️ Sign In as Chief Curator (Dr. Alistair Finch)
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="page-header">
        <h2 class="page-title">Curatorial Content Management (Admin)</h2>
        <p class="page-description">Oversee official heritage routes, 3D LiDAR asset configurations, multilingual translations, and multimedia stories.</p>
      </div>

      <div class="admin-tabs">
        <button class="admin-tab-btn active" data-tab="routes" onclick="AdminCMS.setTab('routes')">Heritage Routes</button>
        <button class="admin-tab-btn" data-tab="landmarks" onclick="AdminCMS.setTab('landmarks')">Monuments & 3D Assets</button>
        <button class="admin-tab-btn" data-tab="translations" onclick="AdminCMS.setTab('translations')">Multilingual Localization</button>
        <button class="admin-tab-btn" data-tab="workflows" onclick="AdminCMS.setTab('workflows')">⚡ n8n Workflows Studio</button>
        <button class="admin-tab-btn" data-tab="openclaw" onclick="AdminCMS.setTab('openclaw')">🦅 Open Claw Researcher</button>
      </div>

      <div id="admin-content-area"></div>
    `;

    AdminCMS.render();
  },

  // Event Tracking
  async trackEvent(type, landmarkId, routeId) {
    try {
      await fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, landmarkId, routeId })
      });
    } catch (e) {}
  },

  // UI Toast Helper
  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>🏛️</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  // Auth Modal
  openAuthModal() {
    const m = document.getElementById('auth-modal');
    if (m) m.classList.remove('hidden');
  },

  closeAuthModal(e) {
    if (e && e.target && e.target.id !== 'auth-modal' && !e.target.classList.contains('modal-close')) return;
    const m = document.getElementById('auth-modal');
    if (m) m.classList.add('hidden');
  },

  setAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(b => {
      b.classList.toggle('active', b.id === `tab-${tab}`);
    });
    const isReg = tab === 'register';
    document.getElementById('group-name').style.display = isReg ? 'flex' : 'none';
    document.getElementById('group-role').style.display = isReg ? 'flex' : 'none';
    document.getElementById('auth-title').textContent = isReg ? 'Create Passport Account' : 'Welcome Back';
    document.getElementById('auth-submit-btn').textContent = isReg ? 'Create Account' : 'Sign In to Guide';
  },

  toggleMobileMenu() {
    const drawer = document.getElementById('mobile-drawer');
    if (drawer) drawer.classList.toggle('open');
  },

  // UNESCO Heritage Certificate Generator
  downloadCertificate() {
    const certCanvas = document.createElement('canvas');
    certCanvas.width = 1200;
    certCanvas.height = 800;
    const ctx = certCanvas.getContext('2d');

    // 1. Dark Marble Background & Gold Outer/Inner Border
    ctx.fillStyle = '#0F131C';
    ctx.fillRect(0, 0, 1200, 800);

    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, 1160, 760);

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(32, 32, 1136, 736);

    // 2. Corner Ornaments
    ctx.fillStyle = '#D4AF37';
    ctx.font = '24px Cinzel, serif';
    ctx.fillText('◈', 40, 60);
    ctx.fillText('◈', 1140, 60);
    ctx.fillText('◈', 40, 750);
    ctx.fillText('◈', 1140, 750);

    // 3. Header & UNESCO Heraldry
    ctx.textAlign = 'center';
    ctx.fillStyle = '#E5B842';
    ctx.font = 'bold 16px Outfit, sans-serif';
    ctx.fillText('UNITED NATIONS EDUCATIONAL, SCIENTIFIC AND CULTURAL ORGANIZATION', 600, 100);

    ctx.font = '13px JetBrains Mono, monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('GLOBAL DIGITAL HERITAGE PRESERVATION INITIATIVE • UNIFIED MENTOR & CyArk', 600, 125);

    ctx.font = 'bold 38px Cinzel, serif';
    ctx.fillStyle = '#FFF';
    ctx.fillText('CERTIFICATE OF EXPLORATION', 600, 195);

    ctx.font = '16px Outfit, sans-serif';
    ctx.fillStyle = '#CBD5E1';
    ctx.fillText('This document certifies that', 600, 250);

    const userName = (this.state.user?.name || 'Marco Rossi').toUpperCase();
    ctx.font = 'bold 36px Cinzel, serif';
    ctx.fillStyle = '#FFE082';
    ctx.fillText(userName, 600, 310);

    // Divider Line
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(350, 335);
    ctx.lineTo(850, 335);
    ctx.stroke();

    const visitedCount = this.state.user?.visitedLandmarks?.length || 4;
    ctx.font = '18px Outfit, sans-serif';
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText(
      `has successfully explored and decoded ${visitedCount} cultural monuments along official heritage corridors`,
      600, 385
    );
    ctx.fillText(
      'utilizing Augmented Reality (WebAR), 3D LiDAR reconstructions, and spatial historical narratives.',
      600, 415
    );

    // 4. Golden Wax Seal & Signatures
    ctx.beginPath();
    ctx.arc(600, 530, 48, 0, Math.PI * 2);
    ctx.fillStyle = '#B88E1C';
    ctx.fill();
    ctx.strokeStyle = '#FFE082';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#0B0E14';
    ctx.font = 'bold 32px Cinzel, serif';
    ctx.fillText('🏛️', 600, 542);

    ctx.font = 'bold 11px Cinzel, serif';
    ctx.fillStyle = '#FFE082';
    ctx.fillText('SEAL OF AUTHENTICITY', 600, 600);

    // Signatures
    ctx.textAlign = 'left';
    ctx.font = '14px Outfit, sans-serif';
    ctx.fillStyle = '#CBD5E1';
    ctx.fillText('Dr. Alistair Finch', 200, 680);
    ctx.font = '12px Outfit, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('Chief Heritage Curator & Documentation Lead', 200, 700);

    ctx.textAlign = 'right';
    ctx.font = '14px Outfit, sans-serif';
    ctx.fillStyle = '#CBD5E1';
    ctx.fillText('Unified Mentor Heritage Board', 1000, 680);
    ctx.font = '12px Outfit, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(`Issued: ${new Date().toLocaleDateString()} • ID: HRDG-${Date.now().toString(36).toUpperCase()}`, 1000, 700);

    // Download PNG
    const link = document.createElement('a');
    link.download = `UNESCO_Heritage_Certificate_${userName.replace(/\s+/g, '_')}.png`;
    link.href = certCanvas.toDataURL('image/png');
    link.click();

    this.showToast('🎓 UNESCO Cultural Explorer Certificate Generated & Downloaded!');
  },

  shareLandmark(landmarkId) {
    const url = `${window.location.origin}/#/landmark/${landmarkId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      this.showToast('🔗 Landmark story link copied to clipboard!');
    } else {
      prompt('Copy shareable story link:', url);
    }
  }
};

window.App = App;
window.addEventListener('DOMContentLoaded', () => App.init());
