// Comprehensive Automated Test Suite for Heritage Route Digital Guide Platform
const http = require('http');

async function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING HERITAGE PLATFORM TEST SUITE ---');
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
    // 1. Static HTML Serving
    const home = await request('/');
    assert(home.status === 200 && typeof home.body === 'string' && home.body.includes('HERITAGE ROUTE'), 'Static index.html served');

    // 2. Routes API
    const routesRes = await request('/api/routes');
    assert(routesRes.status === 200 && Array.isArray(routesRes.body), 'GET /api/routes returns array');
    assert(routesRes.body.length >= 4, `Found ${routesRes.body.length} heritage routes (Rome, Delhi/Agra, Kyoto, Cairo)`);

    const romeRoute = await request('/api/routes/route-rome-imperial');
    assert(romeRoute.status === 200 && romeRoute.body.landmarksData.length === 4, 'GET /api/routes/route-rome-imperial returns populated landmarks');

    // 3. Landmarks API
    const landmarksRes = await request('/api/landmarks');
    assert(landmarksRes.status === 200 && landmarksRes.body.length >= 10, `Found ${landmarksRes.body.length} authentic heritage monuments`);

    const colosseum = await request('/api/landmarks/landmark-colosseum');
    assert(colosseum.status === 200 && colosseum.body.character.name === 'Emperor Vespasian', 'GET /api/landmarks/landmark-colosseum returns Vespasian character and timeline');

    // 4. QR Code Direct Trigger
    const qrRes = await request('/api/qr/lookup/HERITAGE-ROME-COLOSSEUM-72AD');
    assert(qrRes.status === 200 && qrRes.body.landmark.id === 'landmark-colosseum', 'GET /api/qr/lookup verifies Colosseum physical QR code');

    // 5. Auth API: Tourist Login
    const loginTourist = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: 'tourist@heritage.org', password: 'tourist123' }
    });
    assert(loginTourist.status === 200 && loginTourist.body.token, 'Tourist login successful with auth session token');
    const touristToken = loginTourist.body.token;

    // 6. User Auth Me
    const meRes = await request('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${touristToken}` }
    });
    assert(meRes.status === 200 && meRes.body.user.email === 'tourist@heritage.org', 'GET /api/auth/me validates Bearer token');

    // 7. Stamp Passport
    const stampRes = await request('/api/landmarks/landmark-taj-mahal/visit', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${touristToken}` }
    });
    assert(stampRes.status === 200 && stampRes.body.visitedLandmarks.includes('landmark-taj-mahal'), 'POST /api/landmarks/:id/visit stamps Taj Mahal in passport');

    // 8. Toggle Favorite
    const favRes = await request('/api/landmarks/landmark-kinkaku-ji/favorite', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${touristToken}` }
    });
    assert(favRes.status === 200 && favRes.body.isFavorite, 'POST /api/landmarks/:id/favorite bookmarks landmark');

    // 9. User Passport
    const passportRes = await request('/api/user/passport', {
      headers: { 'Authorization': `Bearer ${touristToken}` }
    });
    assert(passportRes.status === 200 && passportRes.body.badges.length >= 5, 'GET /api/user/passport returns stamped seals and unlocked badges');

    // 10. Analytics API
    const analyticsRes = await request('/api/analytics');
    assert(analyticsRes.status === 200 && analyticsRes.body.totalVisitors > 0, 'GET /api/analytics returns visitor metrics and route breakdown');

    // 11. Log Analytics Event
    const eventRes = await request('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { type: 'ar_interaction', landmarkId: 'landmark-pantheon' }
    });
    assert(eventRes.status === 200 && eventRes.body.success, 'POST /api/analytics/event logs AR scan telemetry');

    // 12. Translations API
    const transRes = await request('/api/translations/hi');
    assert(transRes.status === 200 && transRes.body.exploreRoutes.includes('धरोहर'), 'GET /api/translations/hi returns Hindi localization');

    // 13. Admin Login & Authorization
    const loginAdmin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: 'admin@heritage.org', password: 'admin123' }
    });
    assert(loginAdmin.status === 200 && loginAdmin.body.user.role === 'admin', 'Admin login successful');
    const adminToken = loginAdmin.body.token;

    // 14. Admin Protected Route Creation
    const createRouteRes = await request('/api/routes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: {
        title: 'Athens Acropolis Golden Age Trail',
        city: 'Athens',
        country: 'Greece',
        difficulty: 'Easy Walk',
        durationMins: 150,
        distanceKm: 3.2,
        theme: 'Classical Hellenic Architecture',
        description: 'Explore the Parthenon, Erechtheion, and the Theatre of Dionysus on the sacred rock of Athens.'
      }
    });
    assert(createRouteRes.status === 201 && createRouteRes.body.id, 'Admin POST /api/routes successfully creates new heritage corridor');

    console.log(`\n========================================`);
    console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================`);

    if (failed > 0) process.exit(1);
    else process.exit(0);

  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
