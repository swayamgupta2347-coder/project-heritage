// ==========================================================================
// Google Maps Heritage Route Explorer & GPS Proximity Engine
// Native Google Maps tile layers (Roadmap, Satellite LiDAR, Hybrid, Terrain),
// Google Street View 360°, GPS geofencing (<200m), turn-by-turn walking directions
// and Strawberry AI Chrono-Optimizer integration.
// ==========================================================================

const RouteMap = {
  leafletMap: null,
  tileLayer: null,
  route: null,
  landmarks: [],
  selectedLandmark: null,
  mapStyle: 'm', // 'm' (Roadmap), 's' (Satellite), 'y' (Hybrid), 'p' (Terrain), 'streetview'
  zoom: 16,
  
  // Layers & Markers
  markers: [],
  routePolyline: null,
  geofenceCircles: [],
  walkerMarker: null,

  // GPS & Telemetry
  userLocation: null,
  simulatingWalk: false,
  walkerSpeed: 1.0,
  walkerStep: 0,
  walkerTimer: null,
  activeWaypointIndex: 0,
  isAiOptimized: false,
  aiRationale: null,

  // Google Maps Tile Endpoints
  googleTileUrls: {
    'm': 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', // Google Roadmap
    's': 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', // Google Satellite
    'y': 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', // Google Hybrid (Satellite + Labels)
    'p': 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}'  // Google Terrain
  },

  setWalkerSpeed(speed) {
    this.walkerSpeed = parseFloat(speed);
    if (window.App && typeof App.showToast === 'function') {
      App.showToast(`GPS Walker speed: ${speed}x`);
    }
  },

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

    const leafletEl = document.getElementById('google-map-leaflet');
    const iframeEl = document.getElementById('google-map-iframe');

    // Check if Leaflet is available in browser
    if (window.L && leafletEl) {
      this.initLeafletGoogleMap(leafletEl);
    } else {
      // Fallback to direct Google Maps embed
      if (iframeEl) {
        iframeEl.classList.remove('hidden');
        if (leafletEl) leafletEl.classList.add('hidden');
      }
      this.renderIframeEmbed();
    }

    this.renderPinsBar();
    if (this.selectedLandmark) {
      this.updateSidebarCard(this.selectedLandmark);
    }
    this.checkProximityToLandmarks();
  },

  initLeafletGoogleMap(containerEl) {
    // Teardown existing instance if re-initializing
    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
    }

    const center = (this.selectedLandmark && this.selectedLandmark.coordinates) ||
                   (this.route && this.route.centerCoords) ||
                   [41.8902, 12.4922];

    this.leafletMap = L.map(containerEl, {
      center: center,
      zoom: this.zoom,
      zoomControl: true,
      attributionControl: true
    });

    // Mount Google Maps Tile Layer
    this.tileLayer = L.tileLayer(this.googleTileUrls[this.mapStyle] || this.googleTileUrls['m'], {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 20,
      attribution: '&copy; Google Maps'
    }).addTo(this.leafletMap);

    this.renderLeafletLayers();
  },

  renderLeafletLayers() {
    if (!this.leafletMap) return;

    // Clear old markers & lines
    this.markers.forEach(m => m.remove());
    this.markers = [];
    if (this.routePolyline) {
      this.routePolyline.remove();
      this.routePolyline = null;
    }
    this.geofenceCircles.forEach(c => c.remove());
    this.geofenceCircles = [];

    const waypoints = [];

    // Render Markers for each monument
    this.landmarks.forEach((lm, idx) => {
      const [lat, lng] = lm.coordinates;
      waypoints.push([lat, lng]);

      // Custom Google Maps Heritage Pin
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
      
      // Marker Popup
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

      this.markers.push(marker);

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

      this.geofenceCircles.push(circle);
    });

    // Draw Golden Route Polyline connecting stops
    if (waypoints.length > 1) {
      this.routePolyline = L.polyline(waypoints, {
        color: '#E5B842',
        weight: 4,
        opacity: 0.85,
        dashArray: '6, 8',
        lineCap: 'round'
      }).addTo(this.leafletMap);
    }

    // Render GPS Walker Marker
    if (this.userLocation) {
      const walkerIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="gmap-walker-pin"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      if (this.walkerMarker) this.walkerMarker.remove();
      this.walkerMarker = L.marker([this.userLocation.lat, this.userLocation.lng], { icon: walkerIcon }).addTo(this.leafletMap);
    }
  },

  setMapStyle(style) {
    this.mapStyle = style;
    document.querySelectorAll('.layer-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.style === style);
    });

    const leafletEl = document.getElementById('google-map-leaflet');
    const iframeEl = document.getElementById('google-map-iframe');

    if (style === 'streetview') {
      // Switch to Google Street View 360° iframe
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

    // Normal Google Map Layer
    if (iframeEl) iframeEl.classList.add('hidden');
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
    } else {
      this.renderIframeEmbed();
    }
  },

  selectLandmark(landmark) {
    if (!landmark) return;
    this.selectedLandmark = landmark;
    this.zoom = 17;

    const [lat, lng] = landmark.coordinates;

    if (this.leafletMap && this.mapStyle !== 'streetview') {
      this.leafletMap.flyTo([lat, lng], 17, { duration: 1.2 });
      
      // Update marker active state
      document.querySelectorAll('.gmap-marker-pin').forEach(p => p.classList.remove('active'));
      const activePin = document.getElementById(`marker-pin-${landmark.id}`);
      if (activePin) activePin.classList.add('active');

      // Open popup
      const targetMarker = this.markers.find((m, i) => this.landmarks[i]?.id === landmark.id);
      if (targetMarker) {
        targetMarker.openPopup();
      }
    } else {
      this.renderIframeEmbed();
    }

    this.renderPinsBar();
    this.updateSidebarCard(landmark);
    this.checkProximityToLandmarks();

    if (window.App && App.state) {
      App.state.activeLandmarkId = landmark.id;
    }
  },

  fitRouteBounds() {
    this.mapStyle = 'm';
    document.querySelectorAll('.layer-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.style === 'm');
    });

    const leafletEl = document.getElementById('google-map-leaflet');
    const iframeEl = document.getElementById('google-map-iframe');
    if (iframeEl) iframeEl.classList.add('hidden');
    if (leafletEl) leafletEl.classList.remove('hidden');

    if (this.leafletMap) {
      if (this.tileLayer) this.tileLayer.setUrl(this.googleTileUrls['m']);
      if (this.landmarks.length > 0) {
        const bounds = L.latLngBounds(this.landmarks.map(l => l.coordinates));
        this.leafletMap.fitBounds(bounds, { padding: [60, 60] });
      } else if (this.route && this.route.centerCoords) {
        this.leafletMap.setView(this.route.centerCoords, 14);
      }
    } else {
      this.renderIframeEmbed();
    }

    if (window.App && typeof App.showToast === 'function') {
      App.showToast('🗺️ Centered Google Maps on route overview');
    }
  },

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
      iframe.src = `https://maps.google.com/maps?q=${targetLat},${targetLng}+(${encodedName})&z=${this.zoom}&t=${this.mapStyle === 's' ? 'k' : this.mapStyle}&output=embed`;
    }
  },

  renderPinsBar() {
    const bar = document.getElementById('google-map-pins-bar');
    if (!bar) return;

    bar.innerHTML = this.landmarks.map((lm, idx) => {
      const isSelected = this.selectedLandmark && this.selectedLandmark.id === lm.id;
      return `
        <button class="gmap-pin-chip ${isSelected ? 'active' : ''}" onclick="RouteMap.selectLandmark(App.state.landmarks.find(l => l.id === '${lm.id}'))">
          <span>${idx + 1}.</span>
          <span>📍</span>
          <strong>${lm.name.split(' (')[0]}</strong>
          ${lm.isUnlocked ? '<span style="color:#10B981;">✓</span>' : ''}
        </button>
      `;
    }).join('');
  },

  openInGoogleMaps() {
    if (!this.selectedLandmark) return;
    const [destLat, destLng] = this.selectedLandmark.coordinates;
    const userLat = this.userLocation ? this.userLocation.lat : destLat - 0.002;
    const userLng = this.userLocation ? this.userLocation.lng : destLng - 0.002;

    const url = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${destLat},${destLng}&travelmode=walking`;
    window.open(url, '_blank');

    if (window.App && typeof App.showToast === 'function') {
      App.showToast(`🚶 Opening Google Maps walking directions to ${this.selectedLandmark.name}`);
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
    if (!this.userLocation || !this.landmarks.length) return;
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

      // Geofence trigger: within 200m unlocks landmark
      if (dist <= 200) {
        if (!lm.isUnlocked) {
          lm.isUnlocked = true;
          if (window.App) {
            App.showToast(`🎯 In Range! (${dist}m) Story for ${lm.name} is now Unlocked!`);
            App.playAudioChime();
          }
          this.renderPinsBar();
          this.renderLeafletLayers();
        }
      }
    });

    const statusEl = document.getElementById('walker-dist-val');
    if (statusEl && closestLandmark) {
      if (closestDist <= 200) {
        statusEl.style.color = '#10B981';
        statusEl.innerHTML = `🎯 <strong>${closestDist}m</strong> from ${closestLandmark.name.split(' (')[0]} (Within 200m Geofence!)`;
      } else {
        statusEl.style.color = '#E5B842';
        statusEl.innerHTML = `🚶 <strong>${closestDist}m</strong> from ${closestLandmark.name.split(' (')[0]}`;
      }
    }
  },

  async toggleAiOptimization() {
    this.isAiOptimized = !this.isAiOptimized;
    const btn = document.getElementById('map-ai-optimize-btn');
    const banner = document.getElementById('map-ai-banner');

    if (this.isAiOptimized) {
      if (btn) {
        btn.classList.add('active');
        btn.innerHTML = `<span>🍓</span> Strawberry Path Active`;
      }
      if (window.AgenticAI) {
        const res = await AgenticAI.optimizeRoute(this.route.id, 'historical_chronology');
        if (res && res.success) {
          this.aiRationale = res.rationale;
          if (banner) {
            banner.classList.remove('hidden');
            banner.innerHTML = `
              <div class="ai-banner-inner">
                <span class="ai-badge">🍓 STRAWBERRY CHRONO-OPTIMIZER</span>
                <p><strong>Optimal Walking Path:</strong> ${res.rationale}</p>
                <div class="ai-metrics-row">
                  <span>⏱️ Time Saved: <strong>${res.timeSavedMinutes} mins</strong></span>
                  <span>🚶 Sequence: <strong>${res.optimizedSequence.map(s => s.name.split(' ')[0]).join(' ➔ ')}</strong></span>
                </div>
              </div>
            `;
          }

          // Re-sequence landmarks in chronological order
          const sorted = [];
          res.optimizedSequence.forEach(seqItem => {
            const found = this.landmarks.find(l => l.id === seqItem.id);
            if (found) sorted.push(found);
          });
          if (sorted.length === this.landmarks.length) {
            this.landmarks = sorted;
            this.renderPinsBar();
            this.renderLeafletLayers();
            if (this.landmarks.length > 0) {
              this.selectLandmark(this.landmarks[0]);
            }
          }
        }
      }
    } else {
      if (btn) {
        btn.classList.remove('active');
        btn.innerHTML = `<span>🍓</span> Strawberry Smart Path`;
      }
      if (banner) banner.classList.add('hidden');
      this.aiRationale = null;

      // Revert to original route order
      if (window.App && App.state && App.state.landmarks) {
        this.landmarks = App.state.landmarks.filter(l => this.route.landmarks?.includes(l.id));
        this.renderPinsBar();
        this.renderLeafletLayers();
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
        
        // Advance user location closer to target
        const dLat = (targetLat - this.userLocation.lat) * 0.08 * this.walkerSpeed;
        const dLng = (targetLng - this.userLocation.lng) * 0.08 * this.walkerSpeed;

        this.userLocation.lat += dLat;
        this.userLocation.lng += dLng;

        if (this.walkerMarker) {
          this.walkerMarker.setLatLng([this.userLocation.lat, this.userLocation.lng]);
        }

        this.checkProximityToLandmarks();

        // Check if reached destination within 35m
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
