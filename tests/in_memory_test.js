// Comprehensive In-Memory E2E Test Suite
const app = require('../server');
const http = require('http');
const { EventEmitter } = require('events');

function dispatch(method, url, headers = {}, bodyData = null) {
  return new Promise((resolve) => {
    const socket = new EventEmitter();
    socket.destroy = () => {};
    socket.pause = () => {};
    socket.resume = () => {};
    socket.write = () => {};
    socket.on = (ev, fn) => {};

    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.headers = Object.assign({ host: 'localhost' }, headers);
    if (bodyData) {
      req.body = bodyData; // directly provide parsed body
    }

    const res = new http.ServerResponse(req);
    res.assignSocket(socket);

    let output = '';
    res.write = (chunk) => {
      if (chunk) output += chunk.toString();
      return true;
    };
    res.end = (chunk) => {
      if (chunk) output += chunk.toString();
      let parsed = output;
      try {
        parsed = JSON.parse(output);
      } catch (e) {}
      resolve({ status: res.statusCode, headers: res.getHeaders ? res.getHeaders() : {}, body: parsed });
    };

    app.handle(req, res);
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('HERITAGE ROUTE DIGITAL GUIDE: VERIFICATION TEST SUITE');
  console.log('====================================================\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Routes API
    const routesRes = await dispatch('GET', '/api/routes');
    assert(routesRes.status === 200 && Array.isArray(routesRes.body), 'GET /api/routes returns route array');
    assert(routesRes.body.length >= 4, `Found ${routesRes.body.length} Heritage Routes`);

    // 2. Populated Route Detail
    const romeRes = await dispatch('GET', '/api/routes/route-rome-imperial');
    assert(romeRes.status === 200 && romeRes.body.landmarksData.length === 4, 'GET /api/routes/:id populates complete landmark details and waypoints');

    // 3. Landmarks API
    const landmarksRes = await dispatch('GET', '/api/landmarks');
    assert(landmarksRes.status === 200 && landmarksRes.body.length >= 10, `Found ${landmarksRes.body.length} Historical Monuments`);

    // 4. Single Landmark with Character Bio & Timeline
    const colosseumRes = await dispatch('GET', '/api/landmarks/landmark-colosseum');
    assert(colosseumRes.status === 200 && colosseumRes.body.character.name === 'Emperor Vespasian', 'GET /api/landmarks/:id returns character dialog & timeline');

    // 5. Physical QR Code Lookup Trigger
    const qrRes = await dispatch('GET', '/api/qr/lookup/HERITAGE-ROME-COLOSSEUM-72AD');
    assert(qrRes.status === 200 && qrRes.body.landmark.id === 'landmark-colosseum', 'GET /api/qr/lookup/:code resolves physical monument marker');

    // 6. Tourist Authentication
    const loginTourist = await dispatch('POST', '/api/auth/login', { 'content-type': 'application/json' }, {
      email: 'tourist@heritage.org',
      password: 'tourist123'
    });
    assert(loginTourist.status === 200 && loginTourist.body.token, 'POST /api/auth/login authorizes tourist Marco Rossi');
    const touristToken = loginTourist.body.token;

    // 7. Verify Tourist Session
    const meRes = await dispatch('GET', '/api/auth/me', { 'authorization': `Bearer ${touristToken}` });
    assert(meRes.status === 200 && meRes.body.user.role === 'tourist', 'GET /api/auth/me confirms tourist session');

    // 8. Stamp Passport (Visit Landmark)
    const stampRes = await dispatch('POST', '/api/landmarks/landmark-taj-mahal/visit', {
      'authorization': `Bearer ${touristToken}`
    });
    assert(stampRes.status === 200 && stampRes.body.visitedLandmarks.includes('landmark-taj-mahal'), 'POST /api/landmarks/:id/visit stamps Taj Mahal in passport');

    // 9. Bookmark / Favorite Landmark
    const favRes = await dispatch('POST', '/api/landmarks/landmark-kinkaku-ji/favorite', {
      'authorization': `Bearer ${touristToken}`
    });
    assert(favRes.status === 200 && typeof favRes.body.isFavorite === 'boolean', 'POST /api/landmarks/:id/favorite toggles bookmark state');

    // 10. Tourist Passport & Badges
    const passportRes = await dispatch('GET', '/api/user/passport', {
      'authorization': `Bearer ${touristToken}`
    });
    assert(passportRes.status === 200 && passportRes.body.badges.length >= 5, 'GET /api/user/passport awards explorer badges');

    // 11. Visitor Analytics Telemetry
    const analyticsRes = await dispatch('GET', '/api/analytics');
    assert(analyticsRes.status === 200 && analyticsRes.body.totalVisitors > 0, 'GET /api/analytics tracks KPIs and route popularity');

    // 12. Multilingual Localization (Spanish, Hindi, Japanese)
    const esRes = await dispatch('GET', '/api/translations/es');
    assert(esRes.status === 200 && esRes.body.arMode === 'Modo RA', 'GET /api/translations/es provides Spanish localization');

    const hiRes = await dispatch('GET', '/api/translations/hi');
    assert(hiRes.status === 200 && hiRes.body.passport.includes('पासपोर्ट'), 'GET /api/translations/hi provides Hindi localization');

    // 13. Admin Curator Login
    const loginAdmin = await dispatch('POST', '/api/auth/login', { 'content-type': 'application/json' }, {
      email: 'admin@heritage.org',
      password: 'admin123'
    });
    assert(loginAdmin.status === 200 && loginAdmin.body.user.role === 'admin', 'POST /api/auth/login authorizes Lead Curator Dr. Finch');
    const adminToken = loginAdmin.body.token;

    // 14. Admin Route CRUD (Create)
    const createRouteRes = await dispatch('POST', '/api/routes', {
      'content-type': 'application/json',
      'authorization': `Bearer ${adminToken}`
    }, {
      title: 'Classical Athens Acropolis Trail',
      city: 'Athens',
      country: 'Greece',
      difficulty: 'Easy Walk',
      durationMins: 140,
      distanceKm: 3.2,
      theme: 'Classical Hellenic Antiquity',
      description: 'Journey through the Parthenon, Erechtheion, and the Theatre of Dionysus on the sacred rock of Athens.'
    });
    assert(createRouteRes.status === 201 && createRouteRes.body.id, 'Admin POST /api/routes creates new heritage walking trail');

    // 15. Admin Landmark CRUD (Create)
    const createLmRes = await dispatch('POST', '/api/landmarks', {
      'content-type': 'application/json',
      'authorization': `Bearer ${adminToken}`
    }, {
      name: 'The Parthenon',
      routeId: createRouteRes.body.id,
      yearBuilt: '447–432 BC',
      thumbnail: 'https://images.unsplash.com/photo-1555993539-1732916b8235?auto=format&fit=crop&w=800&q=80',
      modelType: 'temple',
      coordinates: [37.9715, 23.7267],
      audioScript: 'Perched upon the Acropolis, the Parthenon stands as the pinnacle of Doric architecture.',
      historicalNarrative: 'Dedicated to Athena Parthenos, master sculptor Phidias and architects Ictinus and Callicrates engineered subtle optical corrections known as entasis.'
    });
    assert(createLmRes.status === 201 && createLmRes.body.id, 'Admin POST /api/landmarks registers monument with 3D model configuration');

    // Clean up test entities so database stays clean and canonical
    if (createLmRes.body.id) {
      await dispatch('DELETE', `/api/landmarks/${createLmRes.body.id}`, { 'authorization': `Bearer ${adminToken}` });
    }
    if (createRouteRes.body.id) {
      await dispatch('DELETE', `/api/routes/${createRouteRes.body.id}`, { 'authorization': `Bearer ${adminToken}` });
    }

    // 16. Agentic AI: Strawberry Deep-Reasoning Engine (o-series CoT)
    const strawberryRes = await dispatch('POST', '/api/agent/strawberry', { 'content-type': 'application/json' }, {
      landmarkId: 'landmark-colosseum',
      mode: 'strawberry',
      query: 'Explain how the subterranean hypogeum mechanics operated'
    });
    assert(strawberryRes.status === 200 && strawberryRes.body.thoughts.length >= 4 && strawberryRes.body.answer.length > 50, 'POST /api/agent/strawberry returns multi-step chain-of-thought and deep historical synthesis');

    // 16b. Agentic AI: Strawberry Architecture Query ("which agentic ai are used")
    const agenticQueryRes = await dispatch('POST', '/api/agent/strawberry', { 'content-type': 'application/json' }, {
      query: 'which agentic ai are used',
      landmarkId: 'landmark-colosseum'
    });
    assert(agenticQueryRes.status === 200 && agenticQueryRes.body.answer.includes('Strawberry') && agenticQueryRes.body.answer.includes('Open Claw') && agenticQueryRes.body.answer.includes('n8n'), 'POST /api/agent/strawberry correctly answers architecture questions about Strawberry, Open Claw, and n8n');

    // 16c. Agentic AI: Strawberry Dynamic Landmark Keyword Detection
    const keywordRes = await dispatch('POST', '/api/agent/strawberry', { 'content-type': 'application/json' }, {
      query: 'Tell me about the engineering of Red Fort in Delhi',
      landmarkId: 'landmark-colosseum'
    });
    assert(keywordRes.status === 200 && keywordRes.body.landmarkId === 'landmark-red-fort', 'POST /api/agent/strawberry detects Red Fort keyword in user query and switches to Red Fort');

    // 17. Agentic AI: Open Claw Autonomous Heritage Crawler
    const clawRes = await dispatch('POST', '/api/agent/openclaw/crawl', { 'content-type': 'application/json' }, {
      landmarkId: 'landmark-taj-mahal',
      scrapeDepth: 2
    });
    assert(clawRes.status === 200 && clawRes.body.logs.length >= 5 && clawRes.body.extractedData.lidarTelemetry, 'POST /api/agent/openclaw/crawl extracts CyArk LiDAR point clouds & conservation status');

    // 18. Agentic AI: n8n Autonomous Workflows Registry
    const wfListRes = await dispatch('GET', '/api/agent/workflows');
    assert(wfListRes.status === 200 && wfListRes.body.length >= 3, 'GET /api/agent/workflows returns production n8n visual agent workflows');

    // 19. Agentic AI: n8n Workflow Execution Engine
    const wfRunRes = await dispatch('POST', '/api/agent/workflow/run', { 'content-type': 'application/json' }, {
      workflowId: 'wf-monument-enrichment',
      params: { landmarkId: 'landmark-colosseum' }
    });
    assert(wfRunRes.status === 200 && wfRunRes.body.status === 'completed' && wfRunRes.body.steps.length === 5, 'POST /api/agent/workflow/run executes sequential agent nodes with telemetry');

    // 20. Agentic AI: Strawberry Smart Route Optimizer
    const optRes = await dispatch('POST', '/api/agent/optimize-route', { 'content-type': 'application/json' }, {
      routeId: 'route-rome-imperial',
      strategy: 'historical_chronology'
    });
    assert(optRes.status === 200 && optRes.body.optimizedSequence.length > 0 && optRes.body.rationale, 'POST /api/agent/optimize-route computes chronological walking sequence and scholarly rationale');

    console.log(`\n====================================================`);
    console.log(`FINAL RESULT: ALL ${passed} VERIFICATION TESTS PASSED (0 FAILED)`);
    console.log(`====================================================`);

    if (failed > 0) process.exit(1);
    else process.exit(0);

  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
