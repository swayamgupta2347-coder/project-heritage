// ==========================================================================
// Admin Content Management System (CMS) Module
// Complete CRUD interface for Heritage Routes, Landmarks, 3D & Translations
// ==========================================================================

const AdminCMS = {
  currentTab: 'routes', // 'routes', 'landmarks', 'translations'

  setTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    this.render();
  },

  render() {
    const container = document.getElementById('admin-content-area');
    if (!container) return;

    if (this.currentTab === 'routes') {
      this.renderRoutesTab(container);
    } else if (this.currentTab === 'landmarks') {
      this.renderLandmarksTab(container);
    } else if (this.currentTab === 'workflows') {
      this.renderWorkflowsTab(container);
    } else if (this.currentTab === 'openclaw') {
      this.renderOpenClawTab(container);
    } else {
      this.renderTranslationsTab(container);
    }
  },

  renderRoutesTab(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <div>
          <h3 style="font-family:var(--font-serif); font-size:20px; color:#FFF;">Heritage Routes Registry</h3>
          <p style="font-size:13px; color:var(--text-secondary);">Manage official walking trails, themes, GPS centers and waypoints</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="AdminCMS.openRouteModal()">
          ＋ Add New Heritage Route
        </button>
      </div>

      <div class="admin-table-card">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Route Title</th>
              <th>City / Country</th>
              <th>Theme</th>
              <th>Distance / Time</th>
              <th>Stops</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${App.state.routes.map(r => `
              <tr>
                <td>
                  <strong style="color:#FFF;">${r.title}</strong>
                  <div style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">${r.id}</div>
                </td>
                <td>${r.city}, ${r.country}</td>
                <td><span class="meta-chip" style="font-size:11px;">${r.theme}</span></td>
                <td>${r.distanceKm} km • ${r.durationMins} mins</td>
                <td>${r.landmarks?.length || 0} monuments</td>
                <td>
                  <div style="display:flex; gap:6px;">
                    <button class="btn btn-secondary btn-sm" onclick="AdminCMS.openRouteModal('${r.id}')">Edit</button>
                    <button class="btn btn-secondary btn-sm" style="color:#FDA4AF;" onclick="AdminCMS.deleteRoute('${r.id}')">Delete</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderLandmarksTab(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <div>
          <h3 style="font-family:var(--font-serif); font-size:20px; color:#FFF;">Monument & AR Landmark Catalog</h3>
          <p style="font-size:13px; color:var(--text-secondary);">Manage 3D procedural geometries, audio narration scripts, and timeline eras</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="AdminCMS.openLandmarkModal()">
          ＋ Add New Landmark
        </button>
      </div>

      <div class="admin-table-card">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Monument</th>
              <th>Year / Era</th>
              <th>3D Geometry</th>
              <th>GPS Coordinates</th>
              <th>Assigned Route</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${App.state.landmarks.map(lm => {
              const routeObj = App.state.routes.find(r => r.id === lm.routeId) || { city: lm.routeId };
              return `
                <tr>
                  <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <img src="${lm.thumbnail}" style="width:36px; height:36px; border-radius:6px; object-fit:cover;">
                      <div>
                        <strong style="color:#FFF;">${lm.name}</strong>
                        <div style="font-size:11px; color:var(--gold-primary);">${lm.nativeName || ''}</div>
                      </div>
                    </div>
                  </td>
                  <td>${lm.yearBuilt}</td>
                  <td><span class="meta-chip" style="font-family:var(--font-mono); font-size:11px;">${lm.modelType}</span></td>
                  <td style="font-family:var(--font-mono); font-size:12px;">${lm.coordinates[0].toFixed(4)}, ${lm.coordinates[1].toFixed(4)}</td>
                  <td>${routeObj.title || routeObj.city}</td>
                  <td>
                    <div style="display:flex; gap:6px;">
                      <button class="btn btn-secondary btn-sm" onclick="AdminCMS.openLandmarkModal('${lm.id}')">Edit</button>
                      <button class="btn btn-secondary btn-sm" style="color:#FDA4AF;" onclick="AdminCMS.deleteLandmark('${lm.id}')">Delete</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderTranslationsTab(container) {
    const activeLang = App.state.currentLang || 'en';
    const dict = App.state.translations || {};

    container.innerHTML = `
      <div style="margin-bottom:20px;">
        <h3 style="font-family:var(--font-serif); font-size:20px; color:#FFF;">Multilingual Localization Editor</h3>
        <p style="font-size:13px; color:var(--text-secondary);">Customize localized storytelling strings for international visitors (${activeLang.toUpperCase()})</p>
      </div>

      <div class="admin-table-card" style="padding:24px;">
        <form onsubmit="AdminCMS.saveTranslations(event)">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
            ${Object.entries(dict).map(([key, val]) => `
              <div class="form-group">
                <label style="font-family:var(--font-mono); font-size:11.5px; color:var(--gold-primary);">${key}</label>
                <input type="text" name="${key}" value="${val}" class="form-input">
              </div>
            `).join('')}
          </div>
          <button type="submit" class="btn btn-primary" style="margin-top:20px;">
            💾 Save Localization Updates
          </button>
        </form>
      </div>
    `;
  },

  // Route Modal
  openRouteModal(routeId) {
    const route = routeId ? App.state.routes.find(r => r.id === routeId) : null;
    const isEdit = !!route;

    const modalHtml = `
      <div class="modal-backdrop" id="crud-modal" onclick="AdminCMS.closeModal(event)">
        <div class="modal-box" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>${isEdit ? 'Edit Heritage Route' : 'Create New Heritage Route'}</h3>
            <button class="modal-close" onclick="AdminCMS.closeModal()">✕</button>
          </div>
          <form onsubmit="AdminCMS.handleRouteSubmit(event, '${routeId || ''}')" style="padding:24px;">
            <div class="form-group">
              <label>Route Title</label>
              <input type="text" id="route-form-title" class="form-input" required value="${route?.title || ''}">
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label>City</label>
                <input type="text" id="route-form-city" class="form-input" required value="${route?.city || ''}">
              </div>
              <div class="form-group">
                <label>Country</label>
                <input type="text" id="route-form-country" class="form-input" required value="${route?.country || ''}">
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label>Walking Distance (km)</label>
                <input type="number" step="0.1" id="route-form-dist" class="form-input" required value="${route?.distanceKm || 3.5}">
              </div>
              <div class="form-group">
                <label>Duration (mins)</label>
                <input type="number" id="route-form-dur" class="form-input" required value="${route?.durationMins || 120}">
              </div>
            </div>
            <div class="form-group">
              <label>Thematic Focus</label>
              <input type="text" id="route-form-theme" class="form-input" required value="${route?.theme || 'Classical Architecture'}">
            </div>
            <div class="form-group">
              <label>Historical Narrative & Overview</label>
              <textarea id="route-form-desc" class="form-input" rows="3" required>${route?.description || ''}</textarea>
            </div>
            <div class="form-group">
              <label>Cover Photo URL</label>
              <input type="url" id="route-form-img" class="form-input" value="${route?.coverImage || ''}">
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
              <button type="button" class="btn btn-secondary" onclick="AdminCMS.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">${isEdit ? 'Update Route' : 'Create Route'}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async handleRouteSubmit(e, routeId) {
    e.preventDefault();
    const token = App.state.token;
    if (!token) {
      App.showToast('⚠️ Please log in as Administrator');
      return;
    }

    const payload = {
      title: document.getElementById('route-form-title').value,
      city: document.getElementById('route-form-city').value,
      country: document.getElementById('route-form-country').value,
      distanceKm: parseFloat(document.getElementById('route-form-dist').value),
      durationMins: parseInt(document.getElementById('route-form-dur').value),
      theme: document.getElementById('route-form-theme').value,
      description: document.getElementById('route-form-desc').value,
      coverImage: document.getElementById('route-form-img').value
    };

    try {
      const url = routeId ? `/api/routes/${routeId}` : '/api/routes';
      const method = routeId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        App.showToast(`✅ Route ${routeId ? 'updated' : 'created'} successfully!`);
        AdminCMS.closeModal();
        await App.fetchRoutes();
        AdminCMS.render();
      } else {
        const err = await res.json();
        App.showToast(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
      App.showToast('Network error saving route');
    }
  },

  async deleteRoute(routeId) {
    if (!confirm('Are you sure you want to remove this heritage route?')) return;
    const token = App.state.token;
    try {
      const res = await fetch(`/api/routes/${routeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        App.showToast('🗑️ Route deleted');
        await App.fetchRoutes();
        AdminCMS.render();
      }
    } catch (err) {
      console.error(err);
    }
  },

  // Landmark Modal
  openLandmarkModal(landmarkId) {
    const lm = landmarkId ? App.state.landmarks.find(l => l.id === landmarkId) : null;
    const isEdit = !!lm;

    const modalHtml = `
      <div class="modal-backdrop" id="crud-modal" onclick="AdminCMS.closeModal(event)">
        <div class="modal-box" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>${isEdit ? 'Edit Monument & AR Model' : 'Register New Monument'}</h3>
            <button class="modal-close" onclick="AdminCMS.closeModal()">✕</button>
          </div>
          <form onsubmit="AdminCMS.handleLandmarkSubmit(event, '${landmarkId || ''}')" style="padding:24px;">
            <div class="form-group">
              <label>Monument Name</label>
              <input type="text" id="lm-form-name" class="form-input" required value="${lm?.name || ''}">
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label>Year Built / Epoch</label>
                <input type="text" id="lm-form-year" class="form-input" required value="${lm?.yearBuilt || ''}">
              </div>
              <div class="form-group">
                <label>3D Procedural Model</label>
                <select id="lm-form-model" class="form-input">
                  <option value="colosseum" ${lm?.modelType === 'colosseum' ? 'selected' : ''}>Colosseum / Amphitheatre</option>
                  <option value="tajmahal" ${lm?.modelType === 'tajmahal' ? 'selected' : ''}>Taj Mahal / Mughal Dome</option>
                  <option value="pagoda-gold" ${lm?.modelType === 'pagoda-gold' ? 'selected' : ''}>Japanese Pagoda / Zen Shrine</option>
                  <option value="pyramid" ${lm?.modelType === 'pyramid' ? 'selected' : ''}>Great Pyramid & Sphinx</option>
                  <option value="arch" ${lm?.modelType === 'arch' ? 'selected' : ''}>Roman Arch of Triumph</option>
                </select>
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label>Latitude</label>
                <input type="number" step="0.0001" id="lm-form-lat" class="form-input" required value="${lm?.coordinates[0] || 41.8902}">
              </div>
              <div class="form-group">
                <label>Longitude</label>
                <input type="number" step="0.0001" id="lm-form-lng" class="form-input" required value="${lm?.coordinates[1] || 12.4922}">
              </div>
            </div>
            <div class="form-group">
              <label>Assigned Heritage Route</label>
              <select id="lm-form-route" class="form-input">
                ${App.state.routes.map(r => `
                  <option value="${r.id}" ${lm?.routeId === r.id ? 'selected' : ''}>${r.title} (${r.city})</option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Audio Guide Narration Text</label>
              <textarea id="lm-form-audio" class="form-input" rows="3" required>${lm?.audioScript || ''}</textarea>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
              <button type="button" class="btn btn-secondary" onclick="AdminCMS.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">${isEdit ? 'Update Monument' : 'Save Monument'}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async handleLandmarkSubmit(e, landmarkId) {
    e.preventDefault();
    const token = App.state.token;
    const payload = {
      name: document.getElementById('lm-form-name').value,
      yearBuilt: document.getElementById('lm-form-year').value,
      modelType: document.getElementById('lm-form-model').value,
      coordinates: [
        parseFloat(document.getElementById('lm-form-lat').value),
        parseFloat(document.getElementById('lm-form-lng').value)
      ],
      routeId: document.getElementById('lm-form-route').value,
      audioScript: document.getElementById('lm-form-audio').value
    };

    try {
      const url = landmarkId ? `/api/landmarks/${landmarkId}` : '/api/landmarks';
      const method = landmarkId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        App.showToast(`✅ Monument ${landmarkId ? 'updated' : 'registered'} successfully!`);
        AdminCMS.closeModal();
        await App.fetchLandmarks();
        AdminCMS.render();
      }
    } catch (err) {
      console.error(err);
    }
  },

  async deleteLandmark(landmarkId) {
    if (!confirm('Are you sure you want to delete this landmark?')) return;
    const token = App.state.token;
    try {
      const res = await fetch(`/api/landmarks/${landmarkId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        App.showToast('🗑️ Landmark deleted');
        await App.fetchLandmarks();
        AdminCMS.render();
      }
    } catch (err) {
      console.error(err);
    }
  },

  async saveTranslations(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const updates = {};
    for (const [k, v] of formData.entries()) {
      updates[k] = v;
    }

    const token = App.state.token;
    const lang = App.state.currentLang || 'en';

    try {
      const res = await fetch(`/api/translations/${lang}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        App.showToast(`✅ Localized strings saved for ${lang.toUpperCase()}`);
        App.state.translations = updates;
        App.applyTranslations();
      }
    } catch (err) {
      console.error(err);
    }
  },

  renderWorkflowsTab(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <div>
          <h3 style="font-family:var(--font-serif); font-size:20px; color:#FFF;">n8n Autonomous Agent Workflows</h3>
          <p style="font-size:13px; color:var(--text-secondary);">Visual event-driven automation pipeline coordinating Open Claw scrapers, Strawberry reasoning agents, and WebAR anchors</p>
        </div>
      </div>
      <div id="admin-n8n-studio-area"></div>
    `;
    if (window.AgenticAI) {
      AgenticAI.renderWorkflowStudio('admin-n8n-studio-area');
    }
  },

  renderOpenClawTab(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <div>
          <h3 style="font-family:var(--font-serif); font-size:20px; color:#FFF;">Open Claw Autonomous Heritage Researcher</h3>
          <p style="font-size:13px; color:var(--text-secondary);">Automated crawler scraping CyArk 3D laser-scan repositories, UNESCO conservation state records, and epigraphic libraries</p>
        </div>
      </div>

      <div class="admin-table-card" style="padding:20px; margin-bottom:24px;">
        <div style="display:grid; grid-template-columns: 1fr 1fr auto; gap:16px; align-items:flex-end;">
          <div>
            <label style="display:block; font-size:12px; color:var(--text-secondary); margin-bottom:6px;">Select Monument to Investigate:</label>
            <select id="claw-target-landmark" class="form-input">
              ${App.state.landmarks.map(l => `<option value="${l.id}">${l.name} (${l.yearBuilt})</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display:block; font-size:12px; color:var(--text-secondary); margin-bottom:6px;">Target Repositories:</label>
            <select id="claw-target-repo" class="form-input">
              <option value="all">CyArk 3D LiDAR + UNESCO SOC + JSTOR Antiquity</option>
              <option value="cyark">CyArk 3D Point-Cloud Database</option>
              <option value="unesco">UNESCO World Heritage Center</option>
            </select>
          </div>
          <button class="btn btn-primary" onclick="AdminCMS.launchOpenClaw()">
            🦅 Launch Autonomous Crawler
          </button>
        </div>
      </div>

      <div id="openclaw-live-results"></div>
    `;
  },

  launchOpenClaw() {
    const lmSelect = document.getElementById('claw-target-landmark');
    const lmId = lmSelect ? lmSelect.value : (App.state.landmarks[0]?.id || 'landmark-colosseum');
    if (window.AgenticAI) {
      AgenticAI.runOpenClaw(lmId, 'openclaw-live-results');
    }
  },

  closeModal(e) {
    if (e && e.target && e.target.id !== 'crud-modal' && !e.target.classList.contains('modal-close')) return;
    const modal = document.getElementById('crud-modal');
    if (modal) modal.remove();
  }
};

window.AdminCMS = AdminCMS;
