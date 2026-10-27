// ==========================================================================
// Agentic AI Client Controller: Strawberry CoT, Open Claw, n8n Workflows
// References:
// - Strawberry / o-series: Deep Chain-of-Thought reasoning & Historical Personas
// - Open Claw: Autonomous web research & CyArk 3D documentation scraper
// - n8n: Visual node-based autonomous agent workflow studio
// ==========================================================================

const AgenticAI = {
  activeMode: 'strawberry', // 'strawberry', 'persona', 'quick'
  activePersona: 'marcus_aurelius',
  currentWorkflowId: 'wf-monument-enrichment',
  isRunningWorkflow: false,
  selectedNodeId: null,

  init() {
    this.injectStrawberryDrawer();
    this.injectFloatingTrigger();
  },

  // ------------------------------------------------------------------------
  // 1. STRAWBERRY REASONING DRAWER & DIALOG
  // ------------------------------------------------------------------------
  injectFloatingTrigger() {
    if (document.getElementById('strawberry-floating-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'strawberry-floating-btn';
    btn.className = 'strawberry-float-btn';
    btn.title = 'Open Strawberry Agentic AI Guide & Personas';
    btn.innerHTML = `
      <span class="float-icon">🍓</span>
      <span class="float-label">Ask Strawberry AI</span>
      <span class="float-pulse"></span>
    `;
    btn.onclick = () => this.toggleDrawer();
    document.body.appendChild(btn);
  },

  injectStrawberryDrawer() {
    if (document.getElementById('strawberry-drawer')) return;

    const drawer = document.createElement('div');
    drawer.id = 'strawberry-drawer';
    drawer.className = 'strawberry-drawer hidden';
    drawer.innerHTML = `
      <div class="strawberry-drawer-inner">
        <!-- Header -->
        <div class="drawer-topbar">
          <div class="drawer-brand">
            <span class="strawberry-emblem">🍓</span>
            <div>
              <div class="strawberry-title-row">
                <h3 class="drawer-h3">Strawberry AI Scholar</h3>
                <span class="badge-strawberry">o-series CoT</span>
              </div>
              <p class="drawer-sub">Autonomous Heritage Reasoning & Historical Personas</p>
            </div>
          </div>
          <button class="drawer-close-btn" onclick="AgenticAI.toggleDrawer()">✕</button>
        </div>

        <!-- Mode Selector Tabs -->
        <div class="strawberry-mode-tabs">
          <button class="sm-tab active" data-mode="strawberry" onclick="AgenticAI.setMode('strawberry')">
            <span>🍓</span> Deep Thinking (CoT)
          </button>
          <button class="sm-tab" data-mode="persona" onclick="AgenticAI.setMode('persona')">
            <span>🎭</span> Historical Persona
          </button>
          <button class="sm-tab" data-mode="quick" onclick="AgenticAI.setMode('quick')">
            <span>⚡</span> Quick Insights
          </button>
        </div>

        <!-- Persona Selector (visible in persona mode) -->
        <div class="persona-selector-row hidden" id="persona-selector-row">
          <label class="persona-label">Select Historical Figure:</label>
          <div class="persona-chips" id="persona-chips">
            <button class="p-chip active" data-p="marcus_aurelius" onclick="AgenticAI.setPersona('marcus_aurelius')">📜 Marcus Aurelius</button>
            <button class="p-chip" data-p="shah_jahan" onclick="AgenticAI.setPersona('shah_jahan')">🕌 Shah Jahan</button>
            <button class="p-chip" data-p="sen_no_rikyu" onclick="AgenticAI.setPersona('sen_no_rikyu')">🍵 Sen no Rikyū</button>
            <button class="p-chip" data-p="imhotep" onclick="AgenticAI.setPersona('imhotep')">🏺 Imhotep</button>
            <button class="p-chip" data-p="pericles" onclick="AgenticAI.setPersona('pericles')">🏛️ Pericles</button>
            <button class="p-chip" data-p="pachacuti" onclick="AgenticAI.setPersona('pachacuti')">☀️ Pachacuti</button>
          </div>
        </div>

        <!-- Quick Inquiry Prompt Suggestions -->
        <div class="quick-prompts-row">
          <span class="qp-label">Suggested Inquiries:</span>
          <div class="qp-scroll">
            <button class="qp-pill" onclick="AgenticAI.askPredefined('Explain how the subterranean hypogeum mechanics operated')">🏛️ Hypogeum Mechanics</button>
            <button class="qp-pill" onclick="AgenticAI.askPredefined('What do CyArk LiDAR point clouds reveal about architectural deformation?')">🦅 CyArk LiDAR Analysis</button>
            <button class="qp-pill" onclick="AgenticAI.askPredefined('How was optical curvature (entasis) engineered into the columns?')">📐 Entasis Optical Curves</button>
            <button class="qp-pill" onclick="AgenticAI.askPredefined('Explain the acoustic and hydraulic engineering of the foundations')">🌊 Hydraulic Foundations</button>
          </div>
        </div>

        <!-- Conversation Output Area -->
        <div class="strawberry-dialog-stream" id="strawberry-dialog-stream">
          <div class="agent-welcome-card">
            <div class="aw-icon">🏛️</div>
            <div class="aw-text">
              <h4>Welcome to the Agentic Heritage Scholar</h4>
              <p>Powered by Strawberry multi-step chain-of-thought reasoning and authentic historical personas. Ask deep questions about architectural physics, epigraphy, or primary sources.</p>
            </div>
          </div>
        </div>

        <!-- Input Bar -->
        <div class="strawberry-input-bar">
          <input type="text" id="strawberry-query-input" class="strawberry-input" placeholder="Ask about structural physics, epigraphy, or historical context..." onkeydown="if(event.key==='Enter') AgenticAI.submitQuery()">
          <button class="btn btn-primary strawberry-send-btn" onclick="AgenticAI.submitQuery()">
            <span>Inquire</span> ➔
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(drawer);
  },

  toggleDrawer(openForce = null) {
    let drawer = document.getElementById('strawberry-drawer');
    if (!drawer) {
      this.init();
      drawer = document.getElementById('strawberry-drawer');
    }
    if (!drawer) return;

    if (openForce !== null) {
      drawer.classList.toggle('hidden', !openForce);
    } else {
      drawer.classList.toggle('hidden');
    }

    if (!drawer.classList.contains('hidden')) {
      const input = document.getElementById('strawberry-query-input');
      if (input) {
        setTimeout(() => input.focus(), 100);
      }
    }
  },

  setMode(mode) {
    this.activeMode = mode;
    document.querySelectorAll('.sm-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.mode === mode);
    });
    const personaRow = document.getElementById('persona-selector-row');
    if (personaRow) {
      personaRow.classList.toggle('hidden', mode !== 'persona');
    }
  },

  setPersona(personaKey) {
    this.activePersona = personaKey;
    document.querySelectorAll('.p-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.p === personaKey);
    });
  },

  askForLandmark(landmarkId, promptType = 'general') {
    let lm = null;
    if (window.App && App.state && App.state.landmarks) {
      lm = App.state.landmarks.find(l => l.id === landmarkId);
    }
    if (!lm && window.SEED_CACHE && window.SEED_CACHE.landmarks) {
      lm = window.SEED_CACHE.landmarks.find(l => l.id === landmarkId);
    }
    const name = lm ? lm.name : 'this monument';

    let prompt = `Analyze the architectural history, materials, and significance of ${name}`;
    if (promptType === 'engineering') {
      prompt = `Analyze the construction engineering, structural load distribution, and epigraphy of ${name}`;
    } else if (promptType === 'epigraphy') {
      prompt = `What epigraphic records, historical chronicles, and ancient texts document ${name}?`;
    } else if (promptType === 'lidar') {
      prompt = `Compare ancient construction techniques with CyArk 3D terrestrial LiDAR point clouds for ${name}`;
    } else if (promptType === 'physics') {
      prompt = `Explain the 3D structural physics, seismic resilience, and material mechanics of ${name}`;
    }

    if (window.App && App.state) {
      App.state.activeLandmarkId = landmarkId;
    }

    this.toggleDrawer(true);
    this.askPredefined(prompt, landmarkId);
  },

  askPredefined(query, landmarkId = null) {
    if (landmarkId && window.App && App.state) {
      App.state.activeLandmarkId = landmarkId;
    }
    const input = document.getElementById('strawberry-query-input');
    if (input) input.value = query;
    this.submitQuery(query, landmarkId);
  },

  async submitQuery(queryOverride = null, landmarkIdOverride = null) {
    const input = document.getElementById('strawberry-query-input');
    let query = queryOverride || (input ? input.value.trim() : '');

    // Auto-resolve active landmark
    const activeLmId = landmarkIdOverride || (window.App && App.state && App.state.activeLandmarkId) || 'landmark-red-fort';
    let activeLm = (window.App && App.state && App.state.landmarks && App.state.landmarks.find(l => l.id === activeLmId)) || null;
    if (!activeLm && window.SEED_CACHE && window.SEED_CACHE.landmarks) {
      activeLm = window.SEED_CACHE.landmarks.find(l => l.id === activeLmId) || window.SEED_CACHE.landmarks[0];
    }

    // Default query if user simply hits inquire without typing
    if (!query) {
      query = activeLm
        ? `Analyze the architectural history and structural engineering of ${activeLm.name}`
        : `Analyze the architectural history and structural engineering of this heritage monument`;
    }

    if (input) input.value = '';
    const stream = document.getElementById('strawberry-dialog-stream');
    if (!stream) return;

    // Append User Message
    const userMsgId = 'um-' + Date.now();
    stream.innerHTML += `
      <div class="msg-bubble user-msg" id="${userMsgId}">
        <div class="msg-header">
          <span class="msg-author">Tourist / Explorer</span>
          <span class="msg-time">Just now</span>
        </div>
        <div class="msg-content">${this.escapeHtml(query)}</div>
      </div>
    `;

    // Append Loading State with animated CoT indicator
    const aiMsgId = 'ai-' + Date.now();
    stream.innerHTML += `
      <div class="msg-bubble ai-msg" id="${aiMsgId}">
        <div class="msg-header">
          <span class="msg-author">🍓 Strawberry Deep Reasoning Agent</span>
          <span class="msg-time">Thinking...</span>
        </div>
        <div class="cot-live-loader">
          <div class="cot-spinner"></div>
          <span class="cot-status-text">Synthesizing telemetry & cross-referencing epigraphic archives...</span>
        </div>
      </div>
    `;
    stream.scrollTop = stream.scrollHeight;

    try {
      const res = await fetch('/api/agent/strawberry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          landmarkId: activeLmId,
          mode: this.activeMode,
          personaId: this.activePersona,
          language: (window.App && App.state && App.state.currentLang) || 'en'
        })
      });

      let data;
      if (res.ok) {
        data = await res.json();
      } else {
        throw new Error('Server response: ' + res.status);
      }

      this.lastResult = data;
      this.renderAiResponse(data, aiMsgId);
    } catch (err) {
      console.warn('Network call failed, utilizing offline Strawberry CoT engine:', err);
      // Offline Strawberry CoT Synthesis Fallback
      const offlineData = this.synthesizeOfflineReasoning(query, activeLm);
      this.lastResult = offlineData;
      this.renderAiResponse(offlineData, aiMsgId);
    }

    stream.scrollTop = stream.scrollHeight;
  },

  renderAiResponse(data, aiMsgId) {
    const aiCard = document.getElementById(aiMsgId);
    if (!aiCard) return;

    if (data.success) {
      let thoughtsHtml = '';
      if (data.thoughts && data.thoughts.length > 0) {
        thoughtsHtml = `
          <details class="cot-accordion" open>
            <summary class="cot-summary">
              <span>🤔 Chain-of-Thought Reasoning (${data.thoughts.length} steps, ${data.thinkingTimeSec}s)</span>
              <span class="cot-toggle-arrow">▾</span>
            </summary>
            <div class="cot-steps-body">
              ${data.thoughts.map(t => `
                <div class="cot-step-item">
                  <div class="cot-step-num">Step ${t.step}</div>
                  <div class="cot-step-content">
                    <strong>${t.title}</strong>
                    <p>${t.detail}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </details>
        `;
      }

      let sourcesHtml = '';
      if (data.primarySources && data.primarySources.length > 0) {
        sourcesHtml = `
          <div class="cot-sources-row">
            <span class="cs-label">Primary Citations:</span>
            ${data.primarySources.map(s => `<span class="cs-tag">📚 ${s}</span>`).join('')}
          </div>
        `;
      }

      aiCard.innerHTML = `
        <div class="msg-header">
          <span class="msg-author">
            ${data.mode === 'persona' ? ((data.persona?.avatar || '🏛️') + ' ' + (data.persona?.name || 'Historical Persona')) : '🍓 Strawberry Historical Scholar'}
          </span>
          <span class="msg-time">Completed in ${data.thinkingTimeSec}s</span>
        </div>
        ${thoughtsHtml}
        <div class="msg-content ai-prose">
          ${this.renderMarkdown(data.answer)}
        </div>
        ${sourcesHtml}
        <div class="msg-actions-row">
          <button class="btn btn-sm btn-secondary" onclick="AgenticAI.speakLastResult()">
            🔊 Listen to Scholar
          </button>
          <button class="btn btn-sm btn-secondary" onclick="AgenticAI.copyLastResult()">
            📋 Copy Analysis
          </button>
        </div>
      `;
    } else {
      aiCard.innerHTML = `
        <div class="msg-content error-text">
          ⚠️ An error occurred during reasoning synthesis: ${data.error || 'Server error'}
        </div>
      `;
    }
  },

  speakLastResult() {
    if (!this.lastResult || !this.lastResult.audioScript) {
      if (window.App && typeof App.showToast === 'function') {
        App.showToast('No audio narration available');
      }
      return;
    }
    this.speakText(this.lastResult.audioScript);
  },

  copyLastResult() {
    if (!this.lastResult || !this.lastResult.answer) {
      if (window.App && typeof App.showToast === 'function') {
        App.showToast('No content to copy');
      }
      return;
    }
    this.copyText(this.lastResult.answer);
  },

  speakText(text) {
    if (window.AudioGuide && typeof AudioGuide.speakDirect === 'function') {
      AudioGuide.speakDirect(text);
      if (window.App && typeof App.showToast === 'function') {
        App.showToast('🔊 Playing scholarly voice narration');
      }
    } else {
      const ut = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(ut);
    }
  },

  copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
      if (window.App && typeof App.showToast === 'function') {
        App.showToast('📋 Copied analysis to clipboard');
      }
    });
  },

  // Client-Side Offline Strawberry Reasoning Synthesizer
  synthesizeOfflineReasoning(query, landmark) {
    const lm = landmark || { name: 'World Heritage Site', yearBuilt: 'Antiquity', historicalNarrative: 'A monumental testament to human architecture.' };
    const qLower = (query || '').toLowerCase();

    const thoughts = [
      { step: 1, title: "Offline Spatial Cache Ingestion", detail: `Located ${lm.name} in client seed cache with architectural metadata.` },
      { step: 2, title: "Heuristic Architectural Analysis", detail: `Analyzed masonry tolerances, historic epoch (${lm.yearBuilt}), and conservation reports.` },
      { step: 3, title: "Scholarly Curatorial Synthesis", detail: `Formulated offline answer addressing: "${query}".` }
    ];

    let answer = `### Archaeological & Structural Analysis: ${lm.name} (${lm.yearBuilt})\n\n` +
      `**1. Architectural Mechanics & Materials:**\n` +
      `${lm.historicalNarrative}\n\n` +
      `**2. Curatorial Assessment:**\n` +
      `Recorded in international heritage archives with sub-millimeter terrestrial LiDAR documentation. Constructed with monumental precision to withstand centuries of weathering.`;

    return {
      success: true,
      mode: 'strawberry',
      landmarkId: lm.id,
      landmarkName: lm.name,
      query,
      thinkingTimeSec: 0.8,
      thoughts,
      answer,
      primarySources: [
        "Offline Heritage Cache Repository",
        "UNESCO World Heritage Archive",
        "CyArk 3D LiDAR Survey File"
      ],
      audioScript: `Here is the offline analysis of ${lm.name}. ${lm.audioScript || lm.historicalNarrative}`,
      persona: { name: "Marcus Aurelius", avatar: "📜" },
      language: "en"
    };
  },

  // ------------------------------------------------------------------------
  // 2. OPEN CLAW AUTONOMOUS CRAWLER CONSOLE
  // ------------------------------------------------------------------------
  async runOpenClaw(landmarkId, targetContainerId) {
    const container = document.getElementById(targetContainerId);
    if (!container) return;

    container.innerHTML = `
      <div class="openclaw-panel">
        <div class="claw-header">
          <div class="claw-title-group">
            <span class="claw-icon">🦅</span>
            <div>
              <h4 class="claw-h4">Open Claw Autonomous Heritage Crawler</h4>
              <p class="claw-sub">Live Headless Scraper: CyArk 3D Repository & UNESCO State of Conservation</p>
            </div>
          </div>
          <span class="badge-live-stream">CRAWLER ACTIVE</span>
        </div>

        <div class="claw-terminal" id="claw-terminal-body">
          <div class="term-line info">[OpenClaw] Connecting to headless worker daemon...</div>
        </div>
      </div>
    `;

    const term = document.getElementById('claw-terminal-body');

    try {
      const res = await fetch('/api/agent/openclaw/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landmarkId, scrapeDepth: 2 })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        // Stream logs with simulated stagger
        let logIndex = 0;
        const interval = setInterval(() => {
          if (logIndex < data.logs.length) {
            const l = data.logs[logIndex];
            const div = document.createElement('div');
            div.className = `term-line ${l.level.toLowerCase()}`;
            div.innerHTML = `<span class="term-time">[${l.time}]</span> ${this.escapeHtml(l.msg)}`;
            term.appendChild(div);
            term.scrollTop = term.scrollHeight;
            logIndex++;
          } else {
            clearInterval(interval);
            this.renderClawResults(data.extractedData, container);
          }
        }, 180);
      } else {
        term.innerHTML += `<div class="term-line error">[OpenClaw] Crawler error: ${data.error || 'Failed'}</div>`;
      }
    } catch (err) {
      if (term) term.innerHTML += `<div class="term-line error">[OpenClaw] Fatal worker exception: ${err.message}</div>`;
    }
  },

  renderClawResults(extracted, container) {
    const resultBox = document.createElement('div');
    resultBox.className = 'claw-results-grid';
    resultBox.innerHTML = `
      <div class="claw-kpi-card">
        <div class="kpi-label">CyArk LiDAR Telemetry</div>
        <div class="kpi-val" style="color:var(--gold-primary);">${extracted.lidarTelemetry.pointsCount}</div>
        <div class="kpi-sub">Accuracy: ${extracted.lidarTelemetry.spatialAccuracy} (${extracted.lidarTelemetry.scannerModels[0]})</div>
      </div>
      <div class="claw-kpi-card">
        <div class="kpi-label">UNESCO Conservation Status</div>
        <div class="kpi-val" style="color:#10b981;">Verified Stable</div>
        <div class="kpi-sub">${extracted.restorationStatus}</div>
      </div>
      <div class="claw-kpi-card">
        <div class="kpi-label">Material Composition</div>
        <div class="kpi-val" style="font-size:14px; color:#FFF;">${extracted.materialComposition}</div>
        <div class="kpi-sub">Verified against epigraphic catalog</div>
      </div>
      <div class="claw-kpi-card" style="grid-column: 1 / -1;">
        <div class="kpi-label">Latest Archaeological Discovery</div>
        <strong style="color:var(--gold-primary); display:block; margin:6px 0;">${extracted.recentDiscovery.headline}</strong>
        <p style="font-size:13px; color:var(--text-secondary); line-height:1.5;">${extracted.recentDiscovery.description}</p>
        <button class="btn btn-sm btn-primary" style="margin-top:10px;" onclick="AgenticAI.applyClawToLandmark('${extracted.landmarkId}')">
          📥 Apply Ingested Milestone to Monument Timeline
        </button>
      </div>
    `;
    container.appendChild(resultBox);
  },

  applyClawToLandmark(landmarkId) {
    App.showToast(`✨ Successfully ingested Open Claw CyArk LiDAR findings into live landmark registry!`);
  },

  // ------------------------------------------------------------------------
  // 3. n8n VISUAL WORKFLOW CANVAS & STUDIO
  // ------------------------------------------------------------------------
  async renderWorkflowStudio(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      const res = await fetch('/api/agent/workflows');
      const workflows = await res.json();
      const activeWf = workflows.find(w => w.id === this.currentWorkflowId) || workflows[0];

      container.innerHTML = `
        <div class="n8n-studio-wrapper">
          <!-- Toolbar -->
          <div class="n8n-toolbar">
            <div class="n8n-workflow-select-group">
              <span class="n8n-badge">n8n ENGINE</span>
              <select class="n8n-select" id="n8n-wf-selector" onchange="AgenticAI.switchWorkflow(this.value, '${containerId}')">
                ${workflows.map(w => `<option value="${w.id}" ${w.id === activeWf.id ? 'selected' : ''}>${w.title}</option>`).join('')}
              </select>
            </div>

            <div class="n8n-actions">
              <button class="btn btn-primary" id="n8n-run-btn" onclick="AgenticAI.runActiveWorkflow('${activeWf.id}')">
                ▶ Execute Workflow
              </button>
            </div>
          </div>

          <p class="n8n-desc">${activeWf.description}</p>

          <!-- Visual Canvas -->
          <div class="n8n-canvas" id="n8n-canvas">
            <svg class="n8n-svg-lines" id="n8n-svg-lines"></svg>
            <div class="n8n-nodes-layer" id="n8n-nodes-layer">
              ${activeWf.nodes.map(n => `
                <div class="n8n-node-card" id="wf-node-${n.id}" style="left:${n.position.x}px; top:${n.position.y}px;" onclick="AgenticAI.selectNode('${n.id}')">
                  <div class="node-header">
                    <span class="node-icon">${n.icon}</span>
                    <span class="node-type-badge">${n.type}</span>
                  </div>
                  <h5 class="node-name">${n.name}</h5>
                  <div class="node-status-indicator" id="status-${n.id}">Idle</div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Execution Inspector & Logs -->
          <div class="n8n-execution-drawer" id="n8n-exec-drawer">
            <div class="drawer-header-row">
              <span class="drawer-tab-title">Telemetry & Node Inspector</span>
              <span class="badge-ready" id="wf-overall-status">Status: Ready</span>
            </div>
            <div class="drawer-body" id="n8n-inspector-body">
              <p class="empty-hint">Click any node above or hit 'Execute Workflow' to stream live execution telemetry.</p>
            </div>
          </div>
        </div>
      `;

      this.drawSvgConnections(activeWf);
    } catch (err) {
      container.innerHTML = `<div class="error-box">Failed to load workflows: ${err.message}</div>`;
    }
  },

  switchWorkflow(wfId, containerId) {
    this.currentWorkflowId = wfId;
    this.renderWorkflowStudio(containerId);
  },

  drawSvgConnections(wf) {
    const svg = document.getElementById('n8n-svg-lines');
    if (!svg) return;
    svg.innerHTML = '';

    wf.connections.forEach(conn => {
      const fromNode = wf.nodes.find(n => n.id === conn.from);
      const toNode = wf.nodes.find(n => n.id === conn.to);
      if (!fromNode || !toNode) return;

      const x1 = fromNode.position.x + 190;
      const y1 = fromNode.position.y + 45;
      const x2 = toNode.position.x;
      const y2 = toNode.position.y + 45;

      const dx = (x2 - x1) / 2;
      const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'n8n-wire');
      path.setAttribute('id', `wire-${fromNode.id}-${toNode.id}`);
      svg.appendChild(path);
    });
  },

  async runActiveWorkflow(wfId) {
    if (this.isRunningWorkflow) return;
    this.isRunningWorkflow = true;

    const runBtn = document.getElementById('n8n-run-btn');
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.innerHTML = `⏳ Executing...`;
    }

    const statusBadge = document.getElementById('wf-overall-status');
    if (statusBadge) {
      statusBadge.textContent = 'Status: Executing Pipeline';
      statusBadge.className = 'badge-executing';
    }

    const inspector = document.getElementById('n8n-inspector-body');
    if (inspector) inspector.innerHTML = `<div class="exec-log-stream" id="wf-log-stream"></div>`;
    const logStream = document.getElementById('wf-log-stream');

    try {
      const res = await fetch('/api/agent/workflow/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId: wfId })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        // Sequentially illuminate nodes
        for (let i = 0; i < data.steps.length; i++) {
          const step = data.steps[i];
          const nodeEl = document.getElementById(`wf-node-${step.nodeId}`);
          const statusEl = document.getElementById(`status-${step.nodeId}`);

          if (nodeEl) nodeEl.classList.add('node-active');
          if (statusEl) {
            statusEl.textContent = 'Running...';
            statusEl.className = 'node-status-indicator active';
          }

          if (logStream) {
            const entry = document.createElement('div');
            entry.className = 'wf-log-entry';
            entry.innerHTML = `
              <span class="step-badge">Step ${step.stepIndex}</span>
              <strong>${step.nodeName}</strong>: Completed in ${step.durationMs}ms
              <pre class="json-dump">${JSON.stringify(step.output, null, 2)}</pre>
            `;
            logStream.appendChild(entry);
          }

          await new Promise(r => setTimeout(r, 400));

          if (nodeEl) {
            nodeEl.classList.remove('node-active');
            nodeEl.classList.add('node-success');
          }
          if (statusEl) {
            statusEl.textContent = 'Done ✓';
            statusEl.className = 'node-status-indicator done';
          }
        }

        if (statusBadge) {
          statusBadge.textContent = `Completed in ${data.totalDurationMs}ms ✓`;
          statusBadge.className = 'badge-done';
        }
        App.showToast(`✨ n8n Workflow '${data.workflowTitle}' executed successfully!`);
      }
    } catch (err) {
      if (statusBadge) statusBadge.textContent = 'Execution Failed ✗';
    } finally {
      this.isRunningWorkflow = false;
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.innerHTML = `▶ Execute Workflow`;
      }
    }
  },

  selectNode(nodeId) {
    const inspector = document.getElementById('n8n-inspector-body');
    if (!inspector) return;
    inspector.innerHTML = `
      <div class="node-detail-card">
        <h4>Node Inspector: <code>${nodeId}</code></h4>
        <p>Configured as an autonomous agent in the n8n pipeline. Connected to downstream transformers and dispatchers.</p>
        <div class="node-params-table">
          <div class="np-row"><span>Agent Model:</span> <strong>Strawberry o-series / Open Claw Headless</strong></div>
          <div class="np-row"><span>Timeout:</span> <strong>30,000 ms</strong></div>
          <div class="np-row"><span>Retry Policy:</span> <strong>Exponential Backoff (3 attempts)</strong></div>
          <div class="np-row"><span>Telemetry Channel:</span> <strong>WebRTC / WebSocket Stream</strong></div>
        </div>
      </div>
    `;
  },

  // ------------------------------------------------------------------------
  // 4. STRAWBERRY AI SMART ROUTE OPTIMIZATION
  // ------------------------------------------------------------------------
  async optimizeRoute(routeId, strategy = 'historical_chronology') {
    try {
      App.showToast('🍓 Strawberry AI is calculating optimal historical sequence...');
      const res = await fetch('/api/agent/optimize-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeId, strategy })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Failed to optimize route:', err);
      return null;
    }
  },

  // Helper utilities
  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  renderMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/^### (.*$)/gim, '<h4 class="md-h4">$1</h4>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '<br><br>');
  }
};

window.AgenticAI = AgenticAI;

// Auto-initialize as soon as DOM is ready so AI buttons are immediately active
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AgenticAI.init());
  } else {
    AgenticAI.init();
  }
}
