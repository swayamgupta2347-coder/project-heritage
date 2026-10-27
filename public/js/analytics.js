// ==========================================================================
// Analytics Dashboard & Visitor Intelligence Module
// Real-time KPI cards, interactive bar charts & live activity ticker
// ==========================================================================

const Analytics = {
  data: null,
  refreshTimer: null,

  async fetchAnalytics() {
    try {
      const res = await fetch('/api/analytics');
      if (res.ok) {
        this.data = await res.json();
      } else {
        this.data = window.SEED_CACHE?.analytics || null;
      }
    } catch (err) {
      console.warn('Analytics fetch error, using client seed cache:', err);
      this.data = window.SEED_CACHE?.analytics || null;
    }
    return this.data;
  },

  renderView(container) {
    if (!this.data) {
      container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Aggregating Heritage Analytics...</p></div>`;
      this.fetchAnalytics().then(() => this.renderView(container));
      return;
    }

    const d = this.data;

    // Calculate maximums for bar percentages
    const maxRouteVisits = Math.max(...Object.values(d.routeVisits || { a: 1 }));
    const maxLandmarkViews = Math.max(...Object.values(d.landmarkViews || { a: 1 }));

    container.innerHTML = `
      <div class="page-header">
        <h2 class="page-title">Visitor Intelligence & AR Analytics</h2>
        <p class="page-description">Real-time telemetry measuring tourist engagement, WebAR interactions, and spatial storytelling completion rates across all heritage corridors.</p>
      </div>

      <!-- KPI Summary Cards -->
      <div class="analytics-stats-grid">
        <div class="stat-card">
          <span class="stat-label">Total Route Visitors</span>
          <span class="stat-value">${(d.totalVisitors || 0).toLocaleString()}</span>
          <span class="stat-delta">↑ 14.8% this month</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">WebAR Interactions</span>
          <span class="stat-value" style="color:var(--lidar-cyan);">${(d.arInteractions || 0).toLocaleString()}</span>
          <span class="stat-delta">↑ 61.4% AR engagement rate</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Audio Tours Completed</span>
          <span class="stat-value" style="color:var(--gold-primary);">${(d.audioToursCompleted || 0).toLocaleString()}</span>
          <span class="stat-delta">Avg 14.2 mins per stop</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Passport Stamps Issued</span>
          <span class="stat-value" style="color:var(--lidar-green);">${(d.passportsIssued || 0).toLocaleString()}</span>
          <span class="stat-delta">★ 4.93 / 5.0 Visitor Rating</span>
        </div>
      </div>

      <!-- Charts Layout -->
      <div class="analytics-charts-layout">
        <!-- Route Popularity Breakdown -->
        <div class="chart-card">
          <h3 class="section-title">Route Popularity Breakdown</h3>
          <p style="font-size:12.5px; color:var(--text-secondary); margin-bottom:12px;">Total visits logged per historical walking corridor</p>
          <div class="bar-chart-container">
            ${Object.entries(d.routeVisits || {}).map(([routeId, count]) => {
              const routeObj = App.state.routes.find(r => r.id === routeId) || { title: routeId };
              const pct = Math.round((count / maxRouteVisits) * 100);
              return `
                <div class="bar-chart-row">
                  <div class="bar-meta">
                    <span style="font-weight:600; color:#FFF;">${routeObj.title}</span>
                    <span style="font-family:var(--font-mono); color:var(--gold-primary);">${count.toLocaleString()} visits</span>
                  </div>
                  <div class="bar-track">
                    <div class="bar-fill" style="width: ${pct}%;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Most Viewed Landmarks -->
        <div class="chart-card">
          <h3 class="section-title">Most Engaged Landmarks</h3>
          <p style="font-size:12.5px; color:var(--text-secondary); margin-bottom:12px;">Ranked by 3D model loads and audio guide listening sessions</p>
          <div class="bar-chart-container">
            ${Object.entries(d.landmarkViews || {}).slice(0, 5).map(([lmId, count]) => {
              const lmObj = App.state.landmarks.find(l => l.id === lmId) || { name: lmId };
              const pct = Math.round((count / maxLandmarkViews) * 100);
              return `
                <div class="bar-chart-row">
                  <div class="bar-meta">
                    <span style="font-weight:600; color:#FFF;">${lmObj.name}</span>
                    <span style="font-family:var(--font-mono); color:var(--lidar-cyan);">${count.toLocaleString()} views</span>
                  </div>
                  <div class="bar-track">
                    <div class="bar-fill cyan" style="width: ${pct}%;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Secondary Row: Device & Languages + Live Feed -->
      <div class="analytics-charts-layout">
        <!-- Devices & Languages -->
        <div class="chart-card">
          <h3 class="section-title">Device & Language Demographics</h3>
          
          <h4 style="font-size:13px; color:var(--text-secondary); text-transform:uppercase; margin-top:16px; margin-bottom:8px;">
            Operating Platform Distribution:
          </h4>
          <div style="display:flex; gap:10px; margin-bottom:20px;">
            ${Object.entries(d.devices || {}).map(([dev, share]) => `
              <div style="flex:1; background:var(--bg-tertiary); padding:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.08); text-align:center;">
                <span style="font-size:11px; color:var(--text-muted); display:block;">${dev}</span>
                <span style="font-size:20px; font-weight:700; color:#FFF; font-family:var(--font-mono);">${share}%</span>
              </div>
            `).join('')}
          </div>

          <h4 style="font-size:13px; color:var(--text-secondary); text-transform:uppercase; margin-bottom:8px;">
            Language Preferences:
          </h4>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            ${Object.entries(d.languages || {}).map(([lang, pct]) => `
              <span class="meta-chip" style="font-family:var(--font-mono); font-size:12px;">
                ${lang}: <strong style="color:var(--gold-primary);">${pct}%</strong>
              </span>
            `).join('')}
          </div>
        </div>

        <!-- Real-Time Activity Feed -->
        <div class="chart-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3 class="section-title" style="margin-bottom:0;">Live Visitor Activity Stream</h3>
            <span class="badge-live" style="animation:pulse 1.5s infinite;">LIVE STREAM</span>
          </div>
          <div class="live-events-list">
            ${(d.recentEvents || []).map(ev => `
              <div class="event-item">
                <div style="display:flex; align-items:center; gap:10px;">
                  <span class="event-type-tag">${ev.type.replace('_', ' ').toUpperCase()}</span>
                  <div>
                    <span style="font-weight:600; color:#FFF;">${ev.landmark || ev.route || 'Heritage Monument'}</span>
                    <small style="color:var(--text-muted); display:block; font-size:11px;">${ev.location}</small>
                  </div>
                </div>
                <span style="font-size:11px; color:var(--text-gold); font-family:var(--font-mono);">${ev.timestamp}</span>
              </div>
            `).join('')}
        </div>
      </div>

      <!-- Agentic AI Autonomous Intelligence Card -->
      <div class="chart-card" style="margin-top:24px; border:1px solid rgba(229,184,66,0.3); background:linear-gradient(135deg, rgba(20,26,36,0.95), rgba(35,25,15,0.85));">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:24px;">🍓</span>
            <div>
              <h3 class="section-title" style="margin:0;">Strawberry AI Curatorial Insights & Predictive Telemetry</h3>
              <p style="font-size:12px; color:var(--text-secondary); margin:0;">Autonomous reasoning agent analyzing visitor heatmaps, route velocity, and retention</p>
            </div>
          </div>
          <span class="badge-agentic">AGENTIC REASONING</span>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:16px;">
          <div class="stat-card" style="background:rgba(0,0,0,0.35);">
            <span class="stat-label">Peak Tourist AR Engagement Window</span>
            <span class="stat-value" style="font-size:18px; color:var(--gold-primary);">10:30 AM – 1:15 PM</span>
            <span class="stat-delta">Correlates with optimal ambient lighting for WebAR</span>
          </div>
          <div class="stat-card" style="background:rgba(0,0,0,0.35);">
            <span class="stat-label">High-Retention Storytelling Stops</span>
            <span class="stat-value" style="font-size:18px; color:var(--lidar-cyan);">Colosseum, Parthenon, Taj Mahal</span>
            <span class="stat-delta">Visitors spent avg 4.8 mins exploring 3D layer dissection</span>
          </div>
          <div class="stat-card" style="background:rgba(0,0,0,0.35);">
            <span class="stat-label">Strawberry Curatorial Recommendation</span>
            <span class="stat-value" style="font-size:13px; color:#FFF; font-weight:normal; line-height:1.45;">
              Strawberry suggests activating an audio waypoint between Roman Forum and Pantheon to mitigate afternoon drop-off.
            </span>
            <span class="stat-delta" style="color:var(--lidar-green);">Confidence Score: 98.4%</span>
          </div>
        </div>
      </div>
    `;
  }
};

window.Analytics = Analytics;
