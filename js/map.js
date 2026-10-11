// ==========================================================================
// Interactive Vector Route Map & GPS Simulation Engine
// Real-time waypoint routing, Haversine proximity detection & geofencing
// ==========================================================================

const RouteMap = {
  canvas: null,
  ctx: null,
  route: null,
  landmarks: [],
  mapStyle: 'antique', // 'antique', 'dark', 'satellite'
  
  // Transform & Pan
  zoom: 1.0,
  panX: 0,
  panY: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,

  // GPS Simulation State
  userLocation: null,
  simulatingWalk: false,
  walkerSpeed: 1.0,
  walkerStep: 0,
  walkerTimer: null,
  activeWaypointIndex: 0,
  selectedLandmark: null,

  setWalkerSpeed(speed) {
    this.walkerSpeed = parseFloat(speed);
    App.showToast(`GPS Walker speed: ${speed}x`);
  },

  init(canvasId, routeData, landmarksData) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.route = routeData;
    this.landmarks = landmarksData || [];

    // Set initial user location at starting point of route
    if (this.landmarks.length > 0) {
      this.userLocation = {
        lat: this.landmarks[0].coordinates[0] - 0.003,
        lng: this.landmarks[0].coordinates[1] - 0.003
      };
      this.selectedLandmark = this.landmarks[0];
    }

    this.resizeCanvas();
    this.setupInteractions();
    this.fitRouteBounds();
    this.render();
  },

  resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = (rect.width || 800) * dpr;
    this.canvas.height = (rect.height || 500) * dpr;
    this.ctx.scale(dpr, dpr);
  },

  setMapStyle(style) {
    this.mapStyle = style;
    document.querySelectorAll('.layer-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.style === style);
    });
    this.render();
  },

  // Fit view bounds so entire route is framed elegantly
  fitRouteBounds() {
    if (!this.landmarks.length) return;
    const lats = this.landmarks.map(l => l.coordinates[0]);
    const lngs = this.landmarks.map(l => l.coordinates[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    this.bounds = { minLat, maxLat, minLng, maxLng };
    this.centerLat = (minLat + maxLat) / 2;
    this.centerLng = (minLng + maxLng) / 2;
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
  },

  // Coordinate Conversion (Mercator Projection into Canvas space)
  geoToCanvas(lat, lng) {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    const latSpan = (this.bounds.maxLat - this.bounds.minLat) || 0.02;
    const lngSpan = (this.bounds.maxLng - this.bounds.minLng) || 0.02;

    const pad = 90;
    const usableW = width - pad * 2;
    const usableH = height - pad * 2;

    const normX = (lng - this.bounds.minLng) / (lngSpan || 0.01);
    const normY = 1.0 - (lat - this.bounds.minLat) / (latSpan || 0.01);

    const cx = pad + normX * usableW;
    const cy = pad + normY * usableH;

    // Apply zoom & pan around canvas center
    const centerX = width / 2;
    const centerY = height / 2;
    const finalX = centerX + (cx - centerX) * this.zoom + this.panX;
    const finalY = centerY + (cy - centerY) * this.zoom + this.panY;

    return { x: finalX, y: finalY };
  },

  canvasToGeo(x, y) {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const pad = 90;
    const usableW = width - pad * 2;
    const usableH = height - pad * 2;

    const centerX = width / 2;
    const centerY = height / 2;
    const unpanX = (x - centerX - this.panX) / this.zoom + centerX;
    const unpanY = (y - centerY - this.panY) / this.zoom + centerY;

    const normX = (unpanX - pad) / usableW;
    const normY = 1.0 - (unpanY - pad) / usableH;

    const latSpan = (this.bounds.maxLat - this.bounds.minLat) || 0.02;
    const lngSpan = (this.bounds.maxLng - this.bounds.minLng) || 0.02;

    return {
      lat: this.bounds.minLat + normY * latSpan,
      lng: this.bounds.minLng + normX * lngSpan
    };
  },

  setupInteractions() {
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.panX += e.clientX - this.dragStartX;
        this.panY += e.clientY - this.dragStartY;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.render();
      }
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
      this.zoom = Math.max(0.6, Math.min(4.0, this.zoom * zoomFactor));
      this.render();
    }, { passive: false });

    // Click waypoint or place user
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      let clickedLandmark = null;
      this.landmarks.forEach(lm => {
        const pt = this.geoToCanvas(lm.coordinates[0], lm.coordinates[1]);
        const dist = Math.hypot(clickX - pt.x, clickY - pt.y);
        if (dist < 25) {
          clickedLandmark = lm;
        }
      });

      if (clickedLandmark) {
        this.selectLandmark(clickedLandmark);
      } else {
        // Relocate simulated user to click position
        const geo = this.canvasToGeo(clickX, clickY);
        this.userLocation = geo;
        this.checkProximityToLandmarks();
        this.render();
      }
    });
  },

  selectLandmark(landmark) {
    this.selectedLandmark = landmark;
    this.render();
    this.updateSidebarCard(landmark);
  },

  // Haversine Distance (returns meters)
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
    if (!this.userLocation) return;
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
          App.showToast(`🎯 In Range! (${dist}m) Story for ${lm.name} is now Unlocked!`);
          App.playAudioChime();
        }
      }
    });

    const statusEl = document.getElementById('walker-dist-val');
    if (statusEl && closestLandmark) {
      statusEl.textContent = `${closestDist}m from ${closestLandmark.name}`;
      if (closestDist <= 200) {
        statusEl.style.color = '#10B981';
      } else {
        statusEl.style.color = '#E5B842';
      }
    }
  },

  toggleWalkerSimulation() {
    this.simulatingWalk = !this.simulatingWalk;
    const btn = document.getElementById('walker-toggle-btn');
    if (btn) {
      btn.textContent = this.simulatingWalk ? '⏸ Pause GPS Walker' : '🚶 Simulate GPS Walker';
      btn.classList.toggle('btn-primary', !this.simulatingWalk);
      btn.classList.toggle('btn-secondary', this.simulatingWalk);
    }

    if (this.simulatingWalk) {
      this.walkerTimer = setInterval(() => {
        this.stepWalker();
      }, 500);
      App.showToast('🚶 GPS Simulation Active: Walking towards route waypoints');
    } else {
      if (this.walkerTimer) clearInterval(this.walkerTimer);
    }
  },

  stepWalker() {
    if (!this.landmarks.length) return;
    const target = this.landmarks[this.activeWaypointIndex];
    if (!target) {
      this.activeWaypointIndex = 0;
      return;
    }

    const currentLat = this.userLocation.lat;
    const currentLng = this.userLocation.lng;
    const targetLat = target.coordinates[0];
    const targetLng = target.coordinates[1];

    const dLat = (targetLat - currentLat) * 0.15 * (this.walkerSpeed || 1.0);
    const dLng = (targetLng - currentLng) * 0.15 * (this.walkerSpeed || 1.0);

    this.userLocation.lat += dLat;
    this.userLocation.lng += dLng;

    const dist = this.calculateDistance(
      this.userLocation.lat, this.userLocation.lng,
      targetLat, targetLng
    );

    if (dist < 40) {
      // Arrived at waypoint! Advance to next
      this.selectLandmark(target);
      this.activeWaypointIndex = (this.activeWaypointIndex + 1) % this.landmarks.length;
    }

    this.checkProximityToLandmarks();
    this.render();
  },

  render() {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;

    // 1. Background Theme Styling
    if (this.mapStyle === 'dark') {
      ctx.fillStyle = '#0B1019';
      ctx.fillRect(0, 0, w, h);
      this.drawGrid(ctx, w, h, 'rgba(0, 242, 254, 0.05)', 40);
    } else if (this.mapStyle === 'satellite') {
      ctx.fillStyle = '#111822';
      ctx.fillRect(0, 0, w, h);
      this.drawTopography(ctx, w, h);
    } else {
      // Antique Parchment Theme
      ctx.fillStyle = '#12161F';
      ctx.fillRect(0, 0, w, h);
      this.drawAntiqueParchment(ctx, w, h);
    }

    if (!this.landmarks.length) return;

    // 2. Draw Historical Route Polyline
    ctx.save();
    ctx.beginPath();
    this.landmarks.forEach((lm, i) => {
      const pt = this.geoToCanvas(lm.coordinates[0], lm.coordinates[1]);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });

    // Outer glow
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(229, 184, 66, 0.3)';
    ctx.stroke();

    // Inner dashed line
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#E5B842';
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.restore();

    // 3. Draw Landmark Waypoint Pins
    this.landmarks.forEach((lm, i) => {
      const pt = this.geoToCanvas(lm.coordinates[0], lm.coordinates[1]);
      const isSelected = this.selectedLandmark && this.selectedLandmark.id === lm.id;
      const isUnlocked = lm.isUnlocked || false;

      // Pin Glow
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isSelected ? 22 : 16, 0, Math.PI * 2);
      ctx.fillStyle = isUnlocked ? 'rgba(16, 185, 129, 0.25)' : 'rgba(229, 184, 66, 0.2)';
      ctx.fill();

      // Pin Center Circle
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isSelected ? 14 : 10, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#FFE082' : (isUnlocked ? '#10B981' : '#E5B842');
      ctx.strokeStyle = '#0B0E14';
      ctx.lineWidth = 2.5;
      ctx.fill();
      ctx.stroke();

      // Number badge
      ctx.fillStyle = '#0B0E14';
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i + 1}`, pt.x, pt.y);

      // Label below pin
      ctx.fillStyle = isSelected ? '#FFE082' : '#E2E8F0';
      ctx.font = isSelected ? '600 12px Outfit, sans-serif' : '500 11px Outfit, sans-serif';
      ctx.fillText(lm.name, pt.x, pt.y + 24);
    });

    // 4. Draw User GPS Location Marker
    if (this.userLocation) {
      const userPt = this.geoToCanvas(this.userLocation.lat, this.userLocation.lng);

      // Pulsing Geofence Ring
      ctx.beginPath();
      ctx.arc(userPt.x, userPt.y, 28, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 242, 254, 0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // User Center Dot
      ctx.beginPath();
      ctx.arc(userPt.x, userPt.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#00F2FE';
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#00F2FE';
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.fillText('YOU (GPS)', userPt.x, userPt.y - 14);
    }

    // 5. Compass Rose in top-right
    this.drawCompass(ctx, w - 45, 45);
  },

  drawGrid(ctx, w, h, strokeStyle, step) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  },

  drawAntiqueParchment(ctx, w, h) {
    // Subtle historical contour lines
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.06)';
    ctx.lineWidth = 1.5;
    for (let r = 80; r < Math.max(w, h); r += 90) {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  drawTopography(ctx, w, h) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i < h; i += 25) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.bezierCurveTo(w * 0.3, i + Math.sin(i) * 15, w * 0.7, i - Math.sin(i) * 15, w, i);
      ctx.stroke();
    }
  },

  drawCompass(ctx, cx, cy) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(11, 14, 20, 0.7)';
    ctx.strokeStyle = 'var(--gold-primary)';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();

    // North Pointer
    ctx.beginPath();
    ctx.moveTo(cx, cy - 16);
    ctx.lineTo(cx - 5, cy + 2);
    ctx.lineTo(cx + 5, cy + 2);
    ctx.fillStyle = '#E11D48';
    ctx.fill();

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 9px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, cy - 6);
    ctx.restore();
  },

  updateSidebarCard(landmark) {
    const cardEl = document.getElementById('selected-landmark-card');
    if (!cardEl || !landmark) return;

    cardEl.innerHTML = `
      <div style="position:relative; height:140px; border-radius:8px; overflow:hidden; margin-bottom:12px;">
        <img src="${landmark.thumbnail}" style="width:100%; height:100%; object-fit:cover;" alt="${landmark.name}">
        <span class="tag-pill" style="position:absolute; top:8px; left:8px;">${landmark.yearBuilt}</span>
      </div>
      <h3 style="font-family:var(--font-serif); font-size:17px; margin-bottom:4px; color:#FFF;">${landmark.name}</h3>
      <p style="font-size:12.5px; color:var(--gold-primary); margin-bottom:8px;">${landmark.era}</p>
      <p style="font-size:13px; color:var(--text-secondary); line-height:1.5; margin-bottom:14px; max-height:80px; overflow-y:auto;">
        ${landmark.historicalNarrative.substring(0, 160)}...
      </p>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <button class="btn btn-primary btn-sm" onclick="App.navigate('landmark/${landmark.id}')">
          📖 View Full Story & Timeline
        </button>
        <button class="btn btn-lidar btn-sm" onclick="App.navigate('ar/${landmark.id}')">
          ✨ Launch WebAR & 3D View
        </button>
        <button class="btn btn-secondary btn-sm" onclick="AudioGuide.loadTrack('${landmark.id}')">
          🎧 Listen to Audio Guide
        </button>
      </div>
    `;
  }
};

window.RouteMap = RouteMap;
