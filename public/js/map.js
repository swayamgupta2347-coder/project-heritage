// ==========================================================================
// Google Maps Heritage Route Explorer & GPS Proximity Engine
// Real-time Google Maps integration: Roadmap, Satellite LiDAR, Street View 360°,
// Haversine geofencing (<200m), turn-by-turn walking directions & Strawberry CoT
// ==========================================================================

const RouteMap = {
  container: null,
  iframe: null,
  route: null,
  landmarks: [],
  selectedLandmark: null,
  mapStyle: 'm', // 'm' (Roadmap), 'k' (Satellite), 'p' (Terrain), 'streetview' (Street View 360°)
  zoom: 16,
  
  // GPS & Telemetry
  userLocation: null,
  simulatingWalk: false,
  walkerSpeed: 1.0,
  walkerStep: 0,
  walkerTimer: null,
  activeWaypointIndex: 0,
  isAiOptimized: false,
  aiRationale: null,

  setWalkerSpeed(speed) {
    this.walkerSpeed = parseFloat(speed);
    if (window.App && typeof App.showToast === 'function') {
      App.showToast(`GPS Walker speed: ${speed}x`);
    }
  },

  init(containerId, routeData, landmarksData) {
    this.route = routeData;
    this.landmarks = landmarksData || [];
    this.container = document.getElementById('google-map-container');
    this.iframe = document.getElementById('google-map-iframe');

    // Default to the first landmark or route center
    if (this.landmarks.length > 0) {
      this.selectedLandmark = this.landmarks[0];
      this.userLocation = {
        lat: this.landmarks[0].coordinates[0] - 0.0022,
        lng: this.landmarks[0].coordinates[1] - 0.0022
      };
    } else if (this.route && this.route.centerCoords) {
      this.userLocation = {
        lat: this.route.centerCoords[0] - 0.002,
        lng: this.route.centerCoords[1] - 0.002
      };
    }

    this.renderMap();
    this.renderPinsBar();
    if (this.selectedLandmark) {
      this.updateSidebarCard(this.selectedLandmark);
    }
    this.checkProximityToLandmarks();
  },

  renderMap() {
    if (!this.iframe) {
      this.iframe = document.getElementById('google-map-iframe');
    }
    if (!this.iframe) return;

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
      // Google Street View 360° interactive panorama embed
      this.iframe.src = `https://maps.google.com/maps?q=&layer=c&cbll=${targetLat},${targetLng}&cbp=11,0,0,0,0&output=svembed`;
    } else {
      // High-resolution Google Maps embed with query label and specific layer
      const encodedName = encodeURIComponent(targetName);
      this.iframe.src = `https://maps.google.com/maps?q=${targetLat},${targetLng}+(${encodedName})&z=${this.zoom}&t=${this.mapStyle}&output=embed`;
    }
  },

  setMapStyle(style) {
    this.mapStyle = style;
    document.querySelectorAll('.layer-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.style === style);
    });
    this.renderMap();

    const styleNames = {
      'm': 'Google Maps Roadmap',
      'k': 'Google Maps Satellite (LiDAR)',
      'p': 'Google Maps Terrain',
      'streetview': 'Google Street View 360°'
    };
    if (window.App && typeof App.showToast === 'function') {
      App.showToast(`Switched view to ${styleNames[style] || 'Google Maps'}`);
    }
  },

  selectLandmark(landmark) {
    if (!landmark) return;
    this.selectedLandmark = landmark;
    this.zoom = 17; // Closer zoom for monument inspection
    this.renderMap();
    this.renderPinsBar();
    this.updateSidebarCard(landmark);
    this.checkProximityToLandmarks();

    if (window.App && App.state) {
      App.state.activeLandmarkId = landmark.id;
    }
  },

  fitRouteBounds() {
    this.mapStyle = 'm';
    this.zoom = 14; // Overview zoom level
    document.querySelectorAll('.layer-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.style === 'm');
    });

    if (this.route && this.route.centerCoords && this.iframe) {
      const [lat, lng] = this.route.centerCoords;
      this.iframe.src = `https://maps.google.com/maps?q=${lat},${lng}&z=${this.zoom}&t=m&output=embed`;
    } else {
      this.renderMap();
    }

    if (window.App && typeof App.showToast === 'function') {
      App.showToast('🗺️ Centered Google Maps on route overview');
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

  // Open Live Turn-by-Turn Walking Directions in Google Maps
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

  // Launch Full Google Street View in new tab
  openStreetViewTab() {
    if (!this.selectedLandmark) return;
    const [lat, lng] = this.selectedLandmark.coordinates;
    const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
    window.open(url, '_blank');
  },

  // Haversine Distance Calculation (returns meters)
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
        }
      }
    });

    const statusEl = document.getElementById('walker-dist-val');
    if (statusEl && closestLandmark) {
      statusEl.textContent = `${closestDist}m from ${closestLandmark.name.split(' (')[0]}`;
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
        
        // Step user location closer to target
        const dLat = (targetLat - this.userLocation.lat) * 0.08 * this.walkerSpeed;
        const dLng = (targetLng - this.userLocation.lng) * 0.08 * this.walkerSpeed;

        this.userLocation.lat += dLat;
        this.userLocation.lng += dLng;

        this.checkProximityToLandmarks();

        // Check if reached destination within 30m
        const dist = this.calculateDistance(
          this.userLocation.lat, this.userLocation.lng,
          targetLat, targetLng
        );

        if (dist < 30) {
          // Arrived at destination
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
