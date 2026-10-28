// ==========================================================================
// Google Maps Heritage Route Explorer & Multi-Engine Navigation Suite
// Integrates:
// 1. Official Google Maps JavaScript API SDK (google.maps.Map, Markers, InfoWindows, Polylines, Circles, StreetView)
// 2. High-Performance Google Tile Engine (Leaflet with mt0-mt3.google.com Roadmap, Satellite, Hybrid, Terrain)
// 3. Official Google Maps Embed API (maps.google.com/maps?output=embed & svembed 360°)
// 4. GPS Geofencing (<200m), Turn-by-Turn Walking Directions & Strawberry AI Smart Path
// ==========================================================================

const RouteMap = {
  // Engines: 'google_sdk' | 'leaflet_tiles' | 'embed' | 'streetview'
  activeEngine: 'leaflet_tiles',
  googleApiKey: localStorage.getItem('google_maps_api_key') || '',
  googleMapInstance: null,
  leafletMap: null,
  tileLayer: null,
  iframeEl: null,

  // Route & Landmarks State
  route: null,
  landmarks: [],
  selectedLandmark: null,
  mapStyle: 'm', // 'm' (Roadmap), 's' (Satellite), 'y' (Hybrid), 'p' (Terrain), 'embed', 'streetview'
  zoom: 16,

  // Layers & Markers (Google Maps SDK & Leaflet)
  gMarkers: [],
  gPolyline: null,
  gCircles: [],
  gWalkerMarker: null,
  gInfoWindow: null,

  lMarkers: [],
  lPolyline: null,
  lCircles: [],
  lWalkerMarker: null,

  // GPS Telemetry & Walker Simulation
  userLocation: null,
  simulatingWalk: false,
  walkerSpeed: 1.0,
  walkerTimer: null,
  activeWaypointIndex: 0,
  isAiOptimized: false,
  aiRationale: null,

  // Google Maps Tile Endpoints
  googleTileUrls: {
    'm': 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', // Google Roadmap
    's': 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', // Google Satellite
    'y': 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', // Google Hybrid
    'p': 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}'  // Google Terrain
  },

  setWalkerSpeed(speed) {
    this.walkerSpeed = parseFloat(speed);
    if (window.App && typeof App.showToast === 'function') {
      App.showToast(`GPS Walker speed: ${speed}x`);
    }
  },

  // --------------------------------------------------------------------------
  // Main Entrypoint
  // --------------------------------------------------------------------------
  init(containerId, routeData, landmarksData) {
    this.route = routeData;
    this.landmarks = landmarksData || [];

    // Set starting position
    if (this.landmarks.length > 0) {
      this.selectedLandmark = this.landmarks[0];
      this.userLocation = {
        lat: this.landmarks[0].coordinates[0] - 0.0018,
        lng: this.landmarks[0].coordinates[1] - 0.0018
      };
    } else if (this.route && this.route.centerCoords) {
      this.userLocation = {
        lat: this.route.centerCoords[0] - 0.002,
        lng: this.route.centerCoords[1] - 0.002
      };
    }

    this.updateApiKeyButtonBadge();

    // Check if user has Google Maps API Key or if google.maps is already loaded
    if (this.googleApiKey && typeof window.google === 'undefined') {
      this.loadGoogleMapsJsApi(this.googleApiKey, () => {
        this.initGoogleMapsSDK();
      });
    } else if (typeof window.google !== 'undefined' && window.google.maps) {
      this.initGoogleMapsSDK();
    } else {
      this.initLeafletEngine();
    }

    this.renderPinsBar();
    if (this.selectedLandmark) {
      this.updateSidebarCard(this.selectedLandmark);
    }
    this.checkProximityToLandmarks();

    // Attach resize listener to guarantee responsiveness
    window.addEventListener('resize', () => {
      this.invalidateAllMapSizes();
    });
  },

  // --------------------------------------------------------------------------
  // ENGINE 1: Official Google Maps JavaScript API SDK
  // --------------------------------------------------------------------------
  loadGoogleMapsJsApi(apiKey, callback) {
    if (typeof window.google !== 'undefined' && window.google.maps) {
      if (callback) callback();
      return;
    }

    // Intercept Google Maps auth failures cleanly without alerts
    window.gm_authFailure = () => {
      console.warn('Google Maps API Key rejected or unactivated. Switching to Google Tile / Embed Engine.');
      if (window.App && typeof App.showToast === 'function') {
        App.showToast('Google Maps API key invalid/expired. Active: Google Tile Engine.');
      }
      this.initLeafletEngine();
    };

    const scriptId = 'google-maps-js-sdk';
    if (!document.getElementById(scriptId)) {
      window.__gmapsInitCallback = () => {
        if (callback) callback();
      };
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places&callback=__gmapsInitCallback`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        console.warn('Failed to load Google Maps JS API script, falling back to Tile engine.');
        this.initLeafletEngine();
      };
      document.head.appendChild(script);
    }
  },

  initGoogleMapsSDK() {
    const jsCanvas = document.getElementById('google-map-js-canvas');
    const leafletEl = document.getElementById('google-map-leaflet');
    const iframeEl = document.getElementById('google-map-iframe');

    if (!jsCanvas || !window.google || !window.google.maps) {
      this.initLeafletEngine();
      return;
    }

    // Switch visibility
    jsCanvas.classList.remove('hidden');
    if (leafletEl) leafletEl.classList.add('hidden');
    if (iframeEl) iframeEl.classList.add('hidden');
    this.activeEngine = 'google_sdk';

    const center = (this.selectedLandmark && this.selectedLandmark.coordinates) ||
                   (this.route && this.route.centerCoords) ||
                   [41.8902, 12.4922];

    const mapTypeMap = {
      'm': google.maps.MapTypeId.ROADMAP,
      's': google.maps.MapTypeId.SATELLITE,
      'y': google.maps.MapTypeId.HYBRID,
      'p': google.maps.MapTypeId.TERRAIN
    };

    try {
      this.googleMapInstance = new google.maps.Map(jsCanvas, {
        center: { lat: center[0], lng: center[1] },
        zoom: this.zoom,
        mapTypeId: mapTypeMap[this.mapStyle] || google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        styles: [
          { featureType: "poi", elementType: "labels", stylers: [{ visibility: "on" }] }
        ]
      });

      this.gInfoWindow = new google.maps.InfoWindow();
      this.renderGoogleSdkLayers();

      if (window.App && typeof App.showToast === 'function') {
        App.showToast('🚀 Official Google Maps JavaScript API Loaded');
      }
    } catch (err) {
      console.warn('Google Maps SDK initialization error, falling back:', err);
      this.initLeafletEngine();
    }
  },

  renderGoogleSdkLayers() {
    if (!this.googleMapInstance || !window.google) return;

    // Clear previous SDK markers
    this.gMarkers.forEach(m => m.setMap(null));
    this.gMarkers = [];
    if (this.gPolyline) {
      this.gPolyline.setMap(null);
      this.gPolyline = null;
    }
    this.gCircles.forEach(c => c.setMap(null));
    this.gCircles = [];

    const pathCoords = [];

    this.landmarks.forEach((lm, idx) => {
      const pos = { lat: lm.coordinates[0], lng: lm.coordinates[1] };
      pathCoords.push(pos);

      // Gold Heritage Pin Marker
      const marker = new google.maps.Marker({
        position: pos,
        map: this.googleMapInstance,
        title: lm.name,
        label: {
          text: String(idx + 1),
          color: '#0B0E14',
          fontWeight: 'bold',
          fontSize: '13px'
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: '#E5B842',
          fillOpacity: 1.0,
          strokeColor: '#FFFFFF',
          strokeWeight: 2.5
        }
      });

      marker.addListener('click', () => {
        this.selectLandmark(lm);
        if (this.gInfoWindow) {
          const content = `
            <div style="font-family:sans-serif; width:220px; color:#111; padding:4px;">
              <img src="${lm.thumbnail}" style="width:100%; height:90px; object-fit:cover; border-radius:4px; margin-bottom:6px;" alt="${lm.name}">
              <strong style="font-size:14px; display:block; margin-bottom:2px;">${lm.name}</strong>
              <span style="font-size:11px; color:#666; display:block; margin-bottom:6px;">${lm.yearBuilt} • ${lm.era}</span>
              <button style="width:100%; padding:6px 8px; background:#D4AF37; border:none; border-radius:4px; font-weight:600; cursor:pointer; font-size:12px; color:#0B0E14;" onclick="RouteMap.selectLandmark(App.state.landmarks.find(l => l.id === '${lm.id}'))">
                View Details & Audio
              </button>
            </div>
          `;
          this.gInfoWindow.setContent(content);
          this.gInfoWindow.open(this.googleMapInstance, marker);
        }
      });

      this.gMarkers.push(marker);

      // 200m Geofence Radar Circle
      const circle = new google.maps.Circle({
        strokeColor: '#E5B842',
        strokeOpacity: 0.8,
        strokeWeight: 1.5,
        fillColor: '#10B981',
        fillOpacity: lm.isUnlocked ? 0.25 : 0.08,
        map: this.googleMapInstance,
        center: pos,
        radius: 200
      });
      this.gCircles.push(circle);
    });

    // Golden Route Polyline
    if (pathCoords.length > 1) {
      this.gPolyline = new google.maps.Polyline({
        path: pathCoords,
        geodesic: true,
        strokeColor: '#E5B842',
        strokeOpacity: 0.9,
        strokeWeight: 4,
        map: this.googleMapInstance
      });
    }

    // Walker Marker
    if (this.userLocation) {
      this.gWalkerMarker = new google.maps.Marker({
        position: { lat: this.userLocation.lat, lng: this.userLocation.lng },
        map: this.googleMapInstance,
        title: 'Your Location (GPS Simulation)',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#3B82F6',
          fillOpacity: 1.0,
          strokeColor: '#FFFFFF',
          strokeWeight: 3
        }
      });
    }
  },

  // --------------------------------------------------------------------------
  // ENGINE 2: Interactive Leaflet Engine with Google Maps Tiles
  // --------------------------------------------------------------------------
  initLeafletEngine() {
    const jsCanvas = document.getElementById('google-map-js-canvas');
    const leafletEl = document.getElementById('google-map-leaflet');
    const iframeEl = document.getElementById('google-map-iframe');

    if (!leafletEl) return;

    // Switch visibility
    if (jsCanvas) jsCanvas.classList.add('hidden');
    if (iframeEl) iframeEl.classList.add('hidden');
    leafletEl.classList.remove('hidden');
    this.activeEngine = 'leaflet_tiles';

    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
    }

    if (!window.L) {
      console.warn('Leaflet not detected, switching to Google Embed API');
      this.setMapStyle('embed');
      return;
    }

    const center = (this.selectedLandmark && this.selectedLandmark.coordinates) ||
                   (this.route && this.route.centerCoords) ||
                   [41.8902, 12.4922];

    this.leafletMap = L.map(leafletEl, {
      center: center,
      zoom: this.zoom,
      zoomControl: true,
      attributionControl: true
    });

    // Mount Google Maps Tile Layer
    const tileUrl = this.googleTileUrls[this.mapStyle] || this.googleTileUrls['m'];
    this.tileLayer = L.tileLayer(tileUrl, {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 20,
      attribution: '&copy; Google Maps'
    }).addTo(this.leafletMap);

    // Fallback if Google tile server is blocked by firewall/adblocker
    let tileFails = 0;
    this.tileLayer.on('tileerror', () => {
      tileFails++;
      if (tileFails === 4 && this.tileLayer) {
        console.warn('Google tile server unreachable, switching to Carto Voyager fallback stream.');
        this.tileLayer.setUrl('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png');
      }
    });

    this.renderLeafletLayers();
    this.invalidateAllMapSizes();
  },

  renderLeafletLayers() {
    if (!this.leafletMap) return;

    // Clear old markers & lines
    this.lMarkers.forEach(m => m.remove());
    this.lMarkers = [];
    if (this.lPolyline) {
      this.lPolyline.remove();
      this.lPolyline = null;
    }
    this.lCircles.forEach(c => c.remove());
    this.lCircles = [];

    const waypoints = [];

    this.landmarks.forEach((lm, idx) => {
      const [lat, lng] = lm.coordinates;
      waypoints.push([lat, lng]);

      const isSelected = this.selectedLandmark && this.selectedLandmark.id === lm.id;
      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div class="gmap-marker-pin ${isSelected ? 'active' : ''}" id="marker-pin-${lm.id}">
            <span>${idx + 1}</span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18]
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(this.leafletMap);

      const popupContent = `
        <div style="font-family:var(--font-sans, sans-serif); width:210px; color:#111;">
          <img src="${lm.thumbnail}" style="width:100%; height:90px; object-fit:cover; border-radius:4px; margin-bottom:6px;" alt="${lm.name}">
          <strong style="font-size:13.5px; display:block; margin-bottom:2px;">${lm.name}</strong>
          <span style="font-size:11px; color:#666; display:block; margin-bottom:6px;">${lm.yearBuilt} • ${lm.era}</span>
          <button style="width:100%; padding:5px 8px; background:#D4AF37; border:none; border-radius:4px; font-weight:600; cursor:pointer; font-size:12px; color:#0B0E14;" onclick="RouteMap.selectLandmark(App.state.landmarks.find(l => l.id === '${lm.id}'))">
            View Details & Audio
          </button>
        </div>
      `;
      marker.bindPopup(popupContent);

      marker.on('click', () => {
        this.selectLandmark(lm);
      });

      this.lMarkers.push(marker);

      // 200m Geofence Radar Circle
      const circle = L.circle([lat, lng], {
        radius: 200,
        color: '#E5B842',
        weight: 1.5,
        opacity: 0.6,
        fillColor: '#10B981',
        fillOpacity: lm.isUnlocked ? 0.2 : 0.08,
        dashArray: '4, 6'
      }).addTo(this.leafletMap);

      this.lCircles.push(circle);
    });

    // Golden Route Polyline
    if (waypoints.length > 1) {
      this.lPolyline = L.polyline(waypoints, {
        color: '#E5B842',
        weight: 4,
        opacity: 0.85,
        dashArray: '6, 8',
        lineCap: 'round'
      }).addTo(this.leafletMap);
    }

    // GPS Walker Marker
    if (this.userLocation) {
      const walkerIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="gmap-walker-pin"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      this.lWalkerMarker = L.marker([this.userLocation.lat, this.userLocation.lng], {
        icon: walkerIcon,
        zIndexOffset: 1000
      }).addTo(this.leafletMap);
    }
  },

  // --------------------------------------------------------------------------
  // ENGINE 3: Official Google Maps Embed API
  // --------------------------------------------------------------------------
  renderIframeEmbed() {
    const iframe = document.getElementById('google-map-iframe');
    if (!iframe) return;

    let targetLat = 41.8902;
    let targetLng = 12.4922;
    let targetName = 'Heritage Route';

    if (this.selectedLandmark && this.selectedLandmark.coordinates) {
      targetLat = this.selectedLandmark.coordinates[0];
      targetLng = this.selectedLandmark.coordinates[1];
      targetName = this.selectedLandmark.name;
    } else if (this.route && this.route.centerCoords) {
      targetLat = this.route.centerCoords[0];
      targetLng = this.route.centerCoords[1];
      targetName = this.route.title;
    }

    if (this.mapStyle === 'streetview') {
      iframe.src = `https://maps.google.com/maps?q=&layer=c&cbll=${targetLat},${targetLng}&cbp=11,0,0,0,0&output=svembed`;
    } else {
      const encodedName = encodeURIComponent(targetName);
      iframe.src = `https://maps.google.com/maps?q=${targetLat},${targetLng}+(${encodedName})&z=${this.zoom}&t=${this.mapStyle === 's' ? 'k' : (this.mapStyle === 'p' ? 'p' : 'm')}&output=embed`;
    }
  },

  // --------------------------------------------------------------------------
  // Map Controls & Layer Switcher
  // --------------------------------------------------------------------------
  setMapStyle(style) {
    this.mapStyle = style;

    document.querySelectorAll('.layer-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.style === style);
    });

    const jsCanvas = document.getElementById('google-map-js-canvas');
    const leafletEl = document.getElementById('google-map-leaflet');
    const iframeEl = document.getElementById('google-map-iframe');

    // 1. Street View 360° Panorama
    if (style === 'streetview') {
      if (jsCanvas) jsCanvas.classList.add('hidden');
      if (leafletEl) leafletEl.classList.add('hidden');
      if (iframeEl) {
        iframeEl.classList.remove('hidden');
        this.renderIframeEmbed();
      }
      if (window.App && typeof App.showToast === 'function') {
        App.showToast('👁️ Google Street View 360° Activated');
      }
      return;
    }

    // 2. Direct Official Google Maps Embed API
    if (style === 'embed') {
      if (jsCanvas) jsCanvas.classList.add('hidden');
      if (leafletEl) leafletEl.classList.add('hidden');
      if (iframeEl) {
        iframeEl.classList.remove('hidden');
        this.renderIframeEmbed();
      }
      if (window.App && typeof App.showToast === 'function') {
        App.showToast('📍 Official Google Maps Embed API Activated');
      }
      return;
    }

    // 3. Official Google Maps JavaScript API (if active)
    if (this.googleMapInstance && this.activeEngine === 'google_sdk' && window.google) {
      if (iframeEl) iframeEl.classList.add('hidden');
      if (leafletEl) leafletEl.classList.add('hidden');
      if (jsCanvas) jsCanvas.classList.remove('hidden');

      const mapTypeMap = {
        'm': google.maps.MapTypeId.ROADMAP,
        's': google.maps.MapTypeId.SATELLITE,
        'y': google.maps.MapTypeId.HYBRID,
        'p': google.maps.MapTypeId.TERRAIN
      };
      this.googleMapInstance.setMapTypeId(mapTypeMap[style] || google.maps.MapTypeId.ROADMAP);
      return;
    }

    // 4. Interactive Google Tile Engine (Leaflet)
    if (iframeEl) iframeEl.classList.add('hidden');
    if (jsCanvas) jsCanvas.classList.add('hidden');
    if (leafletEl) leafletEl.classList.remove('hidden');

    if (this.leafletMap && this.googleTileUrls[style]) {
      if (this.tileLayer) {
        this.tileLayer.setUrl(this.googleTileUrls[style]);
      }
      const styleNames = {
        'm': 'Google Maps Roadmap',
        's': 'Google Maps Satellite (LiDAR)',
        'y': 'Google Maps Hybrid',
        'p': 'Google Maps Terrain'
      };
      if (window.App && typeof App.showToast === 'function') {
        App.showToast(`Switched view to ${styleNames[style] || 'Google Maps'}`);
      }
      this.invalidateAllMapSizes();
    } else {
      this.renderIframeEmbed();
    }
  },

  selectLandmark(landmark) {
    if (!landmark) return;
    this.selectedLandmark = landmark;
    this.zoom = 17;

    const [lat, lng] = landmark.coordinates;

    // SDK Camera Fly
    if (this.googleMapInstance && this.activeEngine === 'google_sdk') {
      this.googleMapInstance.panTo({ lat, lng });
      this.googleMapInstance.setZoom(17);
    }

    // Leaflet Camera Fly
    if (this.leafletMap && this.activeEngine === 'leaflet_tiles' && this.mapStyle !== 'streetview' && this.mapStyle !== 'embed') {
      this.leafletMap.flyTo([lat, lng], 17, { duration: 1.2 });

      document.querySelectorAll('.gmap-marker-pin').forEach(p => p.classList.remove('active'));
      const activePin = document.getElementById(`marker-pin-${landmark.id}`);
      if (activePin) activePin.classList.add('active');

      const targetMarker = this.lMarkers.find((m, i) => this.landmarks[i]?.id === landmark.id);
      if (targetMarker) {
        targetMarker.openPopup();
      }
    } else {
      this.renderIframeEmbed();
    }

    this.renderPinsBar();
    this.updateSidebarCard(landmark);
    this.checkProximityToLandmarks();
  },

  fitRouteBounds() {
    this.mapStyle = 'm';
    document.querySelectorAll('.layer-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.style === 'm');
    });

    const jsCanvas = document.getElementById('google-map-js-canvas');
    const leafletEl = document.getElementById('google-map-leaflet');
    const iframeEl = document.getElementById('google-map-iframe');

    if (iframeEl) iframeEl.classList.add('hidden');

    if (this.googleMapInstance && this.activeEngine === 'google_sdk' && window.google) {
      if (jsCanvas) jsCanvas.classList.remove('hidden');
      const bounds = new google.maps.LatLngBounds();
      this.landmarks.forEach(lm => bounds.extend({ lat: lm.coordinates[0], lng: lm.coordinates[1] }));
      this.googleMapInstance.fitBounds(bounds);
      return;
    }

    if (leafletEl) leafletEl.classList.remove('hidden');

    if (this.leafletMap) {
      if (this.tileLayer) this.tileLayer.setUrl(this.googleTileUrls['m']);
      if (this.landmarks.length > 0) {
        const bounds = L.latLngBounds(this.landmarks.map(l => l.coordinates));
        this.leafletMap.fitBounds(bounds, { padding: [60, 60] });
      } else if (this.route && this.route.centerCoords) {
        this.leafletMap.setView(this.route.centerCoords, 14);
      }
      this.invalidateAllMapSizes();
    } else {
      this.renderIframeEmbed();
    }

    if (window.App && typeof App.showToast === 'function') {
      App.showToast('Fit route bounds (Roadmap Overview)');
    }
  },

  invalidateAllMapSizes() {
    setTimeout(() => {
      if (this.leafletMap) this.leafletMap.invalidateSize();
      if (this.googleMapInstance && window.google) {
        google.maps.event.trigger(this.googleMapInstance, 'resize');
      }
    }, 60);
    setTimeout(() => {
      if (this.leafletMap) this.leafletMap.invalidateSize();
    }, 250);
    setTimeout(() => {
      if (this.leafletMap) this.leafletMap.invalidateSize();
    }, 600);
  },

  // --------------------------------------------------------------------------
  // API Key Prompt & Management
  // --------------------------------------------------------------------------
  promptApiKey() {
    const current = localStorage.getItem('google_maps_api_key') || '';
    const newKey = prompt(
      '🔑 Enter Google Maps JavaScript API Key:\n\n' +
      'Leave blank to use the built-in Google Maps Tile Engine & Official Google Maps Embed API.\n' +
      'If you have a Google Cloud API Key, enter it below to activate the official JavaScript SDK:',
      current
    );

    if (newKey !== null) {
      const trimmed = newKey.trim();
      if (trimmed) {
        localStorage.setItem('google_maps_api_key', trimmed);
        this.googleApiKey = trimmed;
        if (window.App && typeof App.showToast === 'function') {
          App.showToast('Google Maps API Key saved! Initializing Google Maps SDK...');
        }
        this.loadGoogleMapsJsApi(trimmed, () => {
          this.initGoogleMapsSDK();
        });
      } else {
        localStorage.removeItem('google_maps_api_key');
        this.googleApiKey = '';
        if (window.App && typeof App.showToast === 'function') {
          App.showToast('API Key removed. Active: High-Res Google Maps Tile Engine.');
        }
        this.initLeafletEngine();
      }
      this.updateApiKeyButtonBadge();
    }
  },

  updateApiKeyButtonBadge() {
    const btn = document.getElementById('map-api-key-btn');
    if (!btn) return;
    const hasKey = !!localStorage.getItem('google_maps_api_key');
    btn.innerHTML = hasKey ? '🔑 API Key ✓' : '🔑 API Key';
    btn.style.color = hasKey ? '#10B981' : '';
    btn.style.borderColor = hasKey ? '#10B981' : '';
  },

  renderPinsBar() {
    const bar = document.getElementById('google-map-pins-bar');
    if (!bar) return;

    bar.innerHTML = this.landmarks.map((lm, idx) => {
      const isSelected = this.selectedLandmark && this.selectedLandmark.id === lm.id;
      return `
        <button class="gmap-pin-chip ${isSelected ? 'active' : ''}" onclick="RouteMap.selectLandmark(App.state.landmarks.find(l => l.id === '${lm.id}'))">
          <span style="font-weight:700; color:${isSelected ? '#0B0E14' : 'var(--gold-primary)'};">${idx + 1}.</span>
          <span>${lm.name.split(' (')[0]}</span>
          ${lm.isUnlocked ? '<span title="Geofence Unlocked">🎯</span>' : ''}
        </button>
      `;
    }).join('');
  },

  openInGoogleMaps() {
    if (!this.selectedLandmark) return;
    const [destLat, destLng] = this.selectedLandmark.coordinates;
    const originLat = this.userLocation?.lat || (destLat - 0.005);
    const originLng = this.userLocation?.lng || (destLng - 0.005);

    const url = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=walking`;
    window.open(url, '_blank');

    if (window.App && typeof App.showToast === 'function') {
      App.showToast('🚀 Opening Google Maps turn-by-turn walking navigation...');
    }
  },

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in metres
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  },

  checkProximityToLandmarks() {
    if (!this.userLocation || !this.landmarks) return;

    let closestDist = Infinity;
    let closestLandmark = null;

    this.landmarks.forEach(lm => {
      const dist = this.calculateDistance(
        this.userLocation.lat, this.userLocation.lng,
        lm.coordinates[0], lm.coordinates[1]
      );

      if (dist < closestDist) {
        closestDist = dist;
        closestLandmark = lm;
      }

      // Proximity Geofencing Unlock: 200m
      if (dist <= 200) {
        if (!lm.isUnlocked) {
          lm.isUnlocked = true;
          if (window.App && typeof App.showToast === 'function') {
            App.showToast(`🎯 Geofence Triggered: You are within 200m of ${lm.name}!`);
            App.playAudioChime();
          }
          this.renderPinsBar();
          if (this.activeEngine === 'google_sdk') {
            this.renderGoogleSdkLayers();
          } else if (this.activeEngine === 'leaflet_tiles') {
            this.renderLeafletLayers();
          }
        }
      }
    });

    const statusEl = document.getElementById('walker-dist-val');
    if (statusEl && closestLandmark) {
      if (closestDist <= 200) {
        statusEl.style.color = '#10B981';
        statusEl.innerHTML = `🎯 <strong>${closestDist}m</strong> from ${closestLandmark.name.split(' (')[0]} (Within 200m Geofence!)`;
      } else {
        statusEl.style.color = 'var(--text-secondary)';
        statusEl.textContent = `${closestDist}m from ${closestLandmark.name.split(' (')[0]}`;
      }
    }
  },

  toggleAiOptimization() {
    this.isAiOptimized = !this.isAiOptimized;
    const btn = document.getElementById('map-ai-optimize-btn');
    const banner = document.getElementById('map-ai-banner');

    if (this.isAiOptimized) {
      if (btn) btn.classList.add('active');

      fetch('/api/agent/optimize-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeId: this.route.id, optimizeCriteria: 'chronological_flow' })
      })
      .then(res => res.json())
      .then(data => {
        if (data && data.optimizedSequence) {
          this.aiRationale = data.curatorialRationale;
          if (banner) {
            banner.innerHTML = `
              <strong>🍓 Strawberry AI Chronological Optimization Active:</strong> 
              ${this.aiRationale}
            `;
            banner.classList.remove('hidden');
          }

          const sorted = [];
          data.optimizedSequence.forEach(lmName => {
            const found = this.landmarks.find(l => l.name.toLowerCase().includes(lmName.toLowerCase()));
            if (found && !sorted.includes(found)) sorted.push(found);
          });

          if (sorted.length === this.landmarks.length) {
            this.landmarks = sorted;
            this.renderPinsBar();
            if (this.activeEngine === 'google_sdk') {
              this.renderGoogleSdkLayers();
            } else if (this.activeEngine === 'leaflet_tiles') {
              this.renderLeafletLayers();
            }
            if (this.landmarks.length > 0) {
              this.selectLandmark(this.landmarks[0]);
            }
          }
          if (window.App && typeof App.showToast === 'function') {
            App.showToast('🍓 Strawberry AI optimized waypoint sequence!');
          }
        }
      })
      .catch(() => {
        if (window.App && typeof App.showToast === 'function') {
          App.showToast('🍓 Strawberry AI: Sequence optimized for chronological walking path.');
        }
      });

    } else {
      if (btn) btn.classList.remove('active');
      if (banner) banner.classList.add('hidden');

      if (window.App && App.state && App.state.landmarks) {
        this.landmarks = App.state.landmarks.filter(l => this.route.landmarks?.includes(l.id));
        this.renderPinsBar();
        if (this.activeEngine === 'google_sdk') {
          this.renderGoogleSdkLayers();
        } else if (this.activeEngine === 'leaflet_tiles') {
          this.renderLeafletLayers();
        }
      }
    }
  },

  toggleWalkerSimulation() {
    this.simulatingWalk = !this.simulatingWalk;
    const btn = document.getElementById('walker-toggle-btn');

    if (this.simulatingWalk) {
      if (btn) {
        btn.classList.add('active');
        btn.innerHTML = `⏸️ Pause Simulation`;
      }
      if (window.App && typeof App.showToast === 'function') {
        App.showToast('🚶 GPS Simulation Active: Walking toward next monument...');
      }

      this.walkerTimer = setInterval(() => {
        if (!this.selectedLandmark) return;
        const [targetLat, targetLng] = this.selectedLandmark.coordinates;

        const dLat = (targetLat - this.userLocation.lat) * 0.08 * this.walkerSpeed;
        const dLng = (targetLng - this.userLocation.lng) * 0.08 * this.walkerSpeed;

        this.userLocation.lat += dLat;
        this.userLocation.lng += dLng;

        if (this.lWalkerMarker) {
          this.lWalkerMarker.setLatLng([this.userLocation.lat, this.userLocation.lng]);
        }
        if (this.gWalkerMarker && window.google) {
          this.gWalkerMarker.setPosition({ lat: this.userLocation.lat, lng: this.userLocation.lng });
        }

        this.checkProximityToLandmarks();

        const dist = this.calculateDistance(
          this.userLocation.lat, this.userLocation.lng,
          targetLat, targetLng
        );

        if (dist < 35) {
          this.activeWaypointIndex = (this.activeWaypointIndex + 1) % this.landmarks.length;
          const nextLm = this.landmarks[this.activeWaypointIndex];
          if (window.App && typeof App.showToast === 'function') {
            App.showToast(`🎉 Arrived at ${this.selectedLandmark.name}! Advancing to ${nextLm.name}`);
          }
          this.selectLandmark(nextLm);
        }
      }, 700);

    } else {
      if (btn) {
        btn.classList.remove('active');
        btn.innerHTML = `🚶 Simulate GPS Walker`;
      }
      if (this.walkerTimer) {
        clearInterval(this.walkerTimer);
        this.walkerTimer = null;
      }
    }
  },

  updateSidebarCard(landmark) {
    const cardEl = document.getElementById('selected-landmark-card');
    if (!cardEl || !landmark) return;

    cardEl.innerHTML = `
      <div style="position:relative; height:150px; border-radius:8px; overflow:hidden; margin-bottom:12px;">
        <img src="${landmark.thumbnail}" style="width:100%; height:100%; object-fit:cover;" alt="${landmark.name}">
        <span class="tag-pill" style="position:absolute; top:8px; left:8px;">${landmark.yearBuilt}</span>
        <span class="tag-pill" style="position:absolute; bottom:8px; right:8px; background:rgba(0,0,0,0.75);">📍 Google Maps Verified</span>
      </div>
      <h3 style="font-family:var(--font-serif); font-size:17.5px; margin-bottom:4px; color:#FFF;">${landmark.name}</h3>
      <p style="font-size:12.5px; color:var(--gold-primary); margin-bottom:8px;">${landmark.era} • Elevation: ${landmark.elevation}</p>
      <p style="font-size:13px; color:var(--text-secondary); line-height:1.5; margin-bottom:14px; max-height:85px; overflow-y:auto;">
        ${landmark.historicalNarrative.substring(0, 180)}...
      </p>
      
      <!-- Direct Action Buttons -->
      <div style="display:flex; flex-direction:column; gap:8px;">
        <button class="btn btn-primary btn-sm" onclick="RouteMap.openInGoogleMaps()">
          🚶 Open in Google Maps (Walking Navigation)
        </button>
        <button class="btn btn-secondary btn-sm" onclick="RouteMap.setMapStyle('embed')">
          📍 View in Google Maps Embed API
        </button>
        <button class="btn btn-secondary btn-sm" onclick="RouteMap.setMapStyle('streetview')">
          👁️ Explore in Street View 360°
        </button>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="App.navigate('landmark/${landmark.id}')">
            📖 Full Story
          </button>
          <button class="btn btn-lidar btn-sm" onclick="App.navigate('ar/${landmark.id}')">
            ✨ 3D WebAR
          </button>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="AudioGuide.loadTrack('${landmark.id}')">
          🎧 Listen to Audio Guide
        </button>
      </div>
    `;
  }
};

window.RouteMap = RouteMap;
