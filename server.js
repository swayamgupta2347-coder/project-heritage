const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const seedData = require('./data/seed_data');
const agenticService = require('./services/agentic_service');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'database.json');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// In-Memory Database with JSON Persistence
let db = {
  users: [
    {
      id: "user-tourist-1",
      email: "tourist@heritage.org",
      passwordHash: hashPassword("tourist123"),
      name: "Marco Rossi",
      role: "tourist",
      language: "en",
      visitedLandmarks: ["landmark-colosseum"],
      favorites: ["landmark-pantheon", "landmark-taj-mahal"],
      createdAt: new Date().toISOString()
    },
    {
      id: "user-admin-1",
      email: "admin@heritage.org",
      passwordHash: hashPassword("admin123"),
      name: "Dr. Alistair Finch",
      role: "admin",
      title: "Chief Heritage Curator & Documentation Lead",
      language: "en",
      visitedLandmarks: ["landmark-colosseum", "landmark-taj-mahal", "landmark-pyramid-khufu"],
      favorites: ["landmark-colosseum", "landmark-kinkaku-ji"],
      createdAt: new Date().toISOString()
    }
  ],
  routes: JSON.parse(JSON.stringify(seedData.routes)),
  landmarks: JSON.parse(JSON.stringify(seedData.landmarks)),
  translations: JSON.parse(JSON.stringify(seedData.translations)),
  analytics: JSON.parse(JSON.stringify(seedData.initialAnalytics)),
  activeSessions: {}
};

function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}

// Load database if saved file exists
function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

      // Strict de-duplication of routes
      const seenRoutes = new Set();
      db.routes = (data.routes || db.routes).filter(r => {
        if (!r || !r.id || seenRoutes.has(r.id) || seenRoutes.has(r.title)) return false;
        seenRoutes.add(r.id);
        seenRoutes.add(r.title);
        return true;
      });

      // Strict de-duplication of landmarks
      const seenLandmarks = new Set();
      db.landmarks = (data.landmarks || db.landmarks).filter(l => {
        if (!l || !l.id || seenLandmarks.has(l.id) || seenLandmarks.has(l.name)) return false;
        seenLandmarks.add(l.id);
        seenLandmarks.add(l.name);
        return true;
      });

      db.translations = data.translations || db.translations;
      db.analytics = data.analytics || db.analytics;
      if (data.users && data.users.length) {
        db.users = data.users;
      }
      console.log('Database loaded from disk successfully.');
    } else {
      saveDatabase();
    }
  } catch (err) {
    console.error('Error loading database file:', err);
  }
}

function saveDatabase() {
  try {
    const toSave = {
      routes: db.routes,
      landmarks: db.landmarks,
      translations: db.translations,
      analytics: db.analytics,
      users: db.users
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(toSave, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

loadDatabase();

// Auth Helper
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized: Token missing' });

  const userId = db.activeSessions[token];
  if (!userId) return res.status(403).json({ error: 'Session expired or invalid' });

  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(403).json({ error: 'User not found' });

  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Admin privilege required' });
  }
}

// --- AUTHENTICATION ROUTES ---

app.post('/api/auth/register', (req, res) => {
  const { email, password, name, language, role } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'User with this email already exists' });
  }

  const newUser = {
    id: `user-${Date.now()}`,
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    name: name.trim(),
    role: role === 'admin' ? 'admin' : 'tourist',
    language: language || 'en',
    visitedLandmarks: [],
    favorites: [],
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  saveDatabase();

  const token = crypto.randomBytes(24).toString('hex');
  db.activeSessions[token] = newUser.id;

  res.status(201).json({
    token,
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      language: newUser.language,
      visitedLandmarks: newUser.visitedLandmarks,
      favorites: newUser.favorites
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = crypto.randomBytes(24).toString('hex');
  db.activeSessions[token] = user.id;

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      language: user.language,
      visitedLandmarks: user.visitedLandmarks,
      favorites: user.favorites
    }
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      language: req.user.language,
      visitedLandmarks: req.user.visitedLandmarks,
      favorites: req.user.favorites
    }
  });
});

app.put('/api/auth/language', authenticateToken, (req, res) => {
  const { language } = req.body;
  if (language && ['en', 'es', 'fr', 'hi', 'it', 'ja'].includes(language)) {
    req.user.language = language;
    saveDatabase();
    return res.json({ success: true, language });
  }
  res.status(400).json({ error: 'Unsupported language' });
});

// --- ROUTES API ---

app.get('/api/routes', (req, res) => {
  const { city, difficulty, search } = req.query;
  let results = [...db.routes];

  if (city) {
    results = results.filter(r => r.city.toLowerCase().includes(city.toLowerCase()));
  }
  if (difficulty) {
    results = results.filter(r => r.difficulty.toLowerCase().includes(difficulty.toLowerCase()));
  }
  if (search) {
    const q = search.toLowerCase();
    results = results.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.city.toLowerCase().includes(q) ||
      r.country.toLowerCase().includes(q) ||
      (r.tags && r.tags.some(t => t.toLowerCase().includes(q)))
    );
  }

  // Populate landmark count and summary
  const populated = results.map(r => {
    const routeLandmarks = db.landmarks.filter(l => r.landmarks.includes(l.id));
    return {
      ...r,
      totalLandmarks: routeLandmarks.length,
      landmarksPreview: routeLandmarks.map(l => ({
        id: l.id,
        name: l.name,
        thumbnail: l.thumbnail,
        yearBuilt: l.yearBuilt
      }))
    };
  });

  res.json(populated);
});

app.get('/api/routes/:id', (req, res) => {
  const route = db.routes.find(r => r.id === req.params.id);
  if (!route) return res.status(404).json({ error: 'Route not found' });

  // Get full landmark objects in correct order
  const orderedLandmarks = route.landmarks
    .map(id => db.landmarks.find(l => l.id === id))
    .filter(Boolean);

  // Generate smooth elevation and route profile points
  const waypoints = orderedLandmarks.map(l => l.coordinates);

  res.json({
    ...route,
    landmarksData: orderedLandmarks,
    waypoints
  });
});

app.post('/api/routes', authenticateToken, requireAdmin, (req, res) => {
  const { title, city, country, difficulty, durationMins, distanceKm, theme, description, coverImage, tags, centerCoords } = req.body;
  if (!title || !city || !country) {
    return res.status(400).json({ error: 'Title, city, and country are required' });
  }

  const id = `route-${Date.now()}`;
  const newRoute = {
    id,
    title,
    city,
    country,
    region: req.body.region || `${city}, ${country}`,
    difficulty: difficulty || 'Moderate Walk',
    durationMins: Number(durationMins) || 120,
    distanceKm: Number(distanceKm) || 3.5,
    theme: theme || 'Cultural Heritage & History',
    unescoStatus: req.body.unescoStatus || 'Protected Cultural Heritage',
    coverImage: coverImage || 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1200&q=80',
    description: description || 'Historical heritage walking exploration.',
    rating: 5.0,
    reviewCount: 1,
    tags: tags || ['Heritage', 'Audio Tour', '3D LiDAR'],
    centerCoords: centerCoords || [41.8902, 12.4922],
    zoomLevel: 13,
    landmarks: req.body.landmarks || []
  };

  db.routes.push(newRoute);
  saveDatabase();
  res.status(201).json(newRoute);
});

app.put('/api/routes/:id', authenticateToken, requireAdmin, (req, res) => {
  const index = db.routes.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Route not found' });

  db.routes[index] = { ...db.routes[index], ...req.body, id: req.params.id };
  saveDatabase();
  res.json(db.routes[index]);
});

app.delete('/api/routes/:id', authenticateToken, requireAdmin, (req, res) => {
  const index = db.routes.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Route not found' });

  const deleted = db.routes.splice(index, 1);
  saveDatabase();
  res.json({ success: true, deleted: deleted[0] });
});

// --- LANDMARKS API ---

app.get('/api/landmarks', (req, res) => {
  const { routeId, search } = req.query;
  let list = [...db.landmarks];

  if (routeId) {
    list = list.filter(l => l.routeId === routeId);
  }
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.nativeName.toLowerCase().includes(q) ||
      l.historicalNarrative.toLowerCase().includes(q)
    );
  }

  res.json(list);
});

app.get('/api/landmarks/:id', (req, res) => {
  const landmark = db.landmarks.find(l => l.id === req.params.id);
  if (!landmark) return res.status(404).json({ error: 'Landmark not found' });
  res.json(landmark);
});

app.post('/api/landmarks', authenticateToken, requireAdmin, (req, res) => {
  const { name, routeId, coordinates, historicalNarrative, audioScript } = req.body;
  if (!name || !routeId) {
    return res.status(400).json({ error: 'Name and routeId are required' });
  }

  const id = `landmark-${Date.now()}`;
  const newLandmark = {
    id,
    routeId,
    name,
    nativeName: req.body.nativeName || name,
    yearBuilt: req.body.yearBuilt || 'Antiquity',
    era: req.body.era || 'Classical Antiquity',
    coordinates: coordinates || [41.8902, 12.4922],
    elevation: req.body.elevation || '25m above sea level',
    qrCode: `HERITAGE-${Date.now()}`,
    modelType: req.body.modelType || 'temple',
    thumbnail: req.body.thumbnail || 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=800&q=80',
    archivalImage: req.body.archivalImage || 'https://images.unsplash.com/photo-1543429776-2782fc8e1acd?auto=format&fit=crop&w=800&q=80',
    audioDurationSec: req.body.audioDurationSec || 120,
    audioTitle: req.body.audioTitle || `${name} Audio Guide`,
    audioScript: audioScript || historicalNarrative || 'Historical narration for this heritage monument.',
    historicalNarrative: historicalNarrative || 'Comprehensive architectural and archaeological record.',
    timeline: req.body.timeline || [
      { year: req.body.yearBuilt || "100 AD", title: "Construction", description: "Monument erected." }
    ],
    character: req.body.character || {
      name: "Historical Guide",
      title: "Archaeological Chronicler",
      avatar: "🏛️",
      introQuote: "Welcome to this sacred monument of antiquity.",
      dialogues: [
        { question: "Tell me about this monument", answer: historicalNarrative || "A treasure of human heritage." }
      ]
    },
    culturalInsights: req.body.culturalInsights || [
      "Documented for 3D preservation under international heritage conventions."
    ]
  };

  db.landmarks.push(newLandmark);

  // Link to route if not already linked
  const route = db.routes.find(r => r.id === routeId);
  if (route && !route.landmarks.includes(id)) {
    route.landmarks.push(id);
  }

  saveDatabase();
  res.status(201).json(newLandmark);
});

app.put('/api/landmarks/:id', authenticateToken, requireAdmin, (req, res) => {
  const index = db.landmarks.findIndex(l => l.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Landmark not found' });

  db.landmarks[index] = { ...db.landmarks[index], ...req.body, id: req.params.id };
  saveDatabase();
  res.json(db.landmarks[index]);
});

app.delete('/api/landmarks/:id', authenticateToken, requireAdmin, (req, res) => {
  const index = db.landmarks.findIndex(l => l.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Landmark not found' });

  const deleted = db.landmarks.splice(index, 1);
  // Remove reference from routes
  db.routes.forEach(r => {
    r.landmarks = r.landmarks.filter(id => id !== req.params.id);
  });

  saveDatabase();
  res.json({ success: true, deleted: deleted[0] });
});

// --- USER VISITS & PASSPORT STAMPS ---

app.post('/api/landmarks/:id/visit', authenticateToken, (req, res) => {
  const landmark = db.landmarks.find(l => l.id === req.params.id);
  if (!landmark) return res.status(404).json({ error: 'Landmark not found' });

  if (!req.user.visitedLandmarks.includes(landmark.id)) {
    req.user.visitedLandmarks.push(landmark.id);
    db.analytics.passportsIssued += 1;
    db.analytics.recentEvents.unshift({
      id: Date.now(),
      type: "passport_stamp",
      landmark: landmark.name,
      location: landmark.routeId,
      timestamp: "Just now"
    });
    if (db.analytics.recentEvents.length > 20) db.analytics.recentEvents.pop();
    saveDatabase();
  }

  res.json({
    success: true,
    visitedLandmarks: req.user.visitedLandmarks,
    stampedLandmark: landmark
  });
});

app.post('/api/landmarks/:id/favorite', authenticateToken, (req, res) => {
  const landmark = db.landmarks.find(l => l.id === req.params.id);
  if (!landmark) return res.status(404).json({ error: 'Landmark not found' });

  const idx = req.user.favorites.indexOf(landmark.id);
  if (idx === -1) {
    req.user.favorites.push(landmark.id);
  } else {
    req.user.favorites.splice(idx, 1);
  }
  saveDatabase();

  res.json({
    success: true,
    favorites: req.user.favorites,
    isFavorite: req.user.favorites.includes(landmark.id)
  });
});

app.get('/api/user/passport', authenticateToken, (req, res) => {
  const visited = req.user.visitedLandmarks
    .map(id => db.landmarks.find(l => l.id === id))
    .filter(Boolean);

  const favorites = req.user.favorites
    .map(id => db.landmarks.find(l => l.id === id))
    .filter(Boolean);

  // Compute achievements
  const totalLandmarks = db.landmarks.length;
  const visitedCount = visited.length;
  const progressPercent = Math.round((visitedCount / totalLandmarks) * 100);

  const badges = [
    {
      id: "badge-first-step",
      title: "Heritage Initiate",
      description: "Explored your first historical landmark",
      icon: "🏛️",
      unlocked: visitedCount >= 1
    },
    {
      id: "badge-roman-conqueror",
      title: "Roman Antiquary",
      description: "Visited Colosseum or Roman Forum",
      icon: "🛡️",
      unlocked: visited.some(l => l.routeId === 'route-rome-imperial')
    },
    {
      id: "badge-mughal-dynasty",
      title: "Mughal Connoisseur",
      description: "Unlocked the Taj Mahal or Red Fort",
      icon: "🕌",
      unlocked: visited.some(l => l.routeId === 'route-delhi-mughal')
    },
    {
      id: "badge-zen-master",
      title: "Zen Pilgrim",
      description: "Walked Kyoto's temple pathways",
      icon: "⛩️",
      unlocked: visited.some(l => l.routeId === 'route-kyoto-zen')
    },
    {
      id: "badge-pharaoh-explorer",
      title: "Giza Horizon Seeker",
      description: "Decoded the ancient pyramids of Egypt",
      icon: "🏺",
      unlocked: visited.some(l => l.routeId === 'route-cairo-pharaohs')
    },
    {
      id: "badge-grand-voyager",
      title: "UNESCO Grand Voyager",
      description: "Stamped 5 or more heritage landmarks",
      icon: "👑",
      unlocked: visitedCount >= 5
    }
  ];

  res.json({
    user: {
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      joinedAt: req.user.createdAt
    },
    visitedCount,
    totalLandmarks,
    progressPercent,
    visited,
    favorites,
    badges
  });
});

// --- ANALYTICS API ---

app.get('/api/analytics', (req, res) => {
  res.json(db.analytics);
});

app.post('/api/analytics/event', (req, res) => {
  const { type, landmarkId, routeId, durationSec } = req.body;

  if (type === 'ar_interaction' || type === 'ar_scan') {
    db.analytics.arInteractions += 1;
  }
  if (type === 'audio_complete') {
    db.analytics.audioToursCompleted += 1;
  }
  if (type === 'page_view') {
    db.analytics.totalVisitors += 1;
  }

  if (landmarkId && db.analytics.landmarkViews[landmarkId] !== undefined) {
    db.analytics.landmarkViews[landmarkId] += 1;
  } else if (landmarkId) {
    db.analytics.landmarkViews[landmarkId] = 1;
  }

  if (routeId && db.analytics.routeVisits[routeId] !== undefined) {
    db.analytics.routeVisits[routeId] += 1;
  }

  const landmarkObj = db.landmarks.find(l => l.id === landmarkId);
  const routeObj = db.routes.find(r => r.id === routeId);

  const eventEntry = {
    id: Date.now(),
    type: type || 'visit',
    landmark: landmarkObj ? landmarkObj.name : (routeObj ? routeObj.title : 'Heritage Portal'),
    location: routeObj ? routeObj.city : 'Digital Stream',
    timestamp: 'Just now'
  };

  db.analytics.recentEvents.unshift(eventEntry);
  if (db.analytics.recentEvents.length > 25) {
    db.analytics.recentEvents.pop();
  }

  saveDatabase();
  res.json({ success: true, event: eventEntry });
});

// --- TRANSLATIONS API ---

app.get('/api/translations/:lang', (req, res) => {
  const lang = req.params.lang || 'en';
  const dict = db.translations[lang] || db.translations['en'];
  res.json(dict);
});

app.put('/api/translations/:lang', authenticateToken, requireAdmin, (req, res) => {
  const lang = req.params.lang;
  if (!lang) return res.status(400).json({ error: 'Language code required' });

  db.translations[lang] = { ...db.translations[lang], ...req.body };
  saveDatabase();
  res.json(db.translations[lang]);
});

// QR Code Direct Lookup Trigger
app.get('/api/qr/lookup/:code', (req, res) => {
  const code = req.params.code;
  const landmark = db.landmarks.find(l => l.qrCode.toLowerCase() === code.toLowerCase());
  if (!landmark) return res.status(404).json({ error: 'QR Code not associated with any monument' });

  db.analytics.arInteractions += 1;
  db.analytics.recentEvents.unshift({
    id: Date.now(),
    type: "qr_triggered",
    landmark: landmark.name,
    location: landmark.routeId,
    timestamp: "Just now"
  });
  saveDatabase();

  res.json({
    success: true,
    landmarkId: landmark.id,
    routeId: landmark.routeId,
    landmark
  });
});

// --- AGENTIC AI & AUTONOMOUS WORKFLOWS API ---

// 1. Strawberry Deep Reasoning & Historical Personas
app.post('/api/agent/strawberry', (req, res) => {
  try {
    const { query, landmarkId, mode, personaId, language } = req.body || {};
    const result = agenticService.runStrawberryReasoning({ query, landmarkId, mode, personaId, language, db });
    
    // Log AI interaction in analytics
    db.analytics.recentEvents.unshift({
      id: Date.now(),
      type: "ai_reasoning",
      landmark: result.landmarkName,
      location: `Strawberry AI (${mode || 'reasoning'})`,
      timestamp: "Just now"
    });
    if (db.analytics.recentEvents.length > 25) db.analytics.recentEvents.pop();
    saveDatabase();

    res.json(result);
  } catch (err) {
    console.error('Strawberry AI error:', err);
    res.status(500).json({ error: 'Failed to process AI reasoning request' });
  }
});

// 2. Open Claw Autonomous Heritage Crawler
app.post('/api/agent/openclaw/crawl', (req, res) => {
  try {
    const { landmarkId, targetDomain, scrapeDepth } = req.body || {};
    const result = agenticService.runOpenClawCrawler({ landmarkId, targetDomain, scrapeDepth, db });
    
    // Log crawler event
    db.analytics.recentEvents.unshift({
      id: Date.now(),
      type: "openclaw_crawl",
      landmark: result.extractedData.landmarkName,
      location: "Open Claw Heritage Crawler",
      timestamp: "Just now"
    });
    if (db.analytics.recentEvents.length > 25) db.analytics.recentEvents.pop();
    saveDatabase();

    res.json(result);
  } catch (err) {
    console.error('Open Claw crawler error:', err);
    res.status(500).json({ error: 'Crawler execution failed' });
  }
});

// 3. n8n Autonomous Workflows Registry
app.get('/api/agent/workflows', (req, res) => {
  res.json(agenticService.getWorkflows());
});

// 4. n8n Workflow Execution Engine
app.post('/api/agent/workflow/run', (req, res) => {
  try {
    const { workflowId, params } = req.body || {};
    const result = agenticService.executeWorkflow({ workflowId, params, db });
    
    db.analytics.recentEvents.unshift({
      id: Date.now(),
      type: "workflow_executed",
      landmark: result.workflowTitle,
      location: "n8n Agentic Canvas",
      timestamp: "Just now"
    });
    if (db.analytics.recentEvents.length > 25) db.analytics.recentEvents.pop();
    saveDatabase();

    res.json(result);
  } catch (err) {
    console.error('Workflow execution error:', err);
    res.status(500).json({ error: 'Failed to execute agent workflow' });
  }
});

// 5. Strawberry Smart Route Optimizer
app.post('/api/agent/optimize-route', (req, res) => {
  try {
    const { routeId, strategy } = req.body || {};
    const result = agenticService.optimizeRoute({ routeId, strategy, db });
    res.json(result);
  } catch (err) {
    console.error('Route optimizer error:', err);
    res.status(500).json({ error: 'Route optimization failed' });
  }
});

// Fallback to SPA index.html
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err && !res.headersSent) {
      res.status(err.status || 404).end();
    }
  });
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`Heritage Route Digital Guide Platform Server Running`);
    console.log(`Port: http://localhost:${PORT}`);
    console.log(`Environment: Production / Ready`);
    console.log(`====================================================`);
  });
}
