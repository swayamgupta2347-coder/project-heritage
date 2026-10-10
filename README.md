# 🏛️ Heritage Route Digital Guide Platform
> **Web-based interactive guide utilizing Augmented Reality (WebAR) storytelling, CyArk-inspired 3D LiDAR documentation, and izi.TRAVEL spatial audio tours along historical heritage corridors.**

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-5.2.1-blue.svg)](https://expressjs.com/)
[![WebGL](https://img.shields.io/badge/WebGL-3D%20LiDAR%20Engine-cyan.svg)](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
[![WebAR](https://img.shields.io/badge/WebAR-Camera%20Overlay-rose.svg)](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
[![License: MIT](https://img.shields.io/badge/License-MIT-gold.svg)](LICENSE)
[![Status: Production Ready](https://img.shields.io/badge/Status-Production%20Ready-success.svg)]()

---

## 🌟 Overview & Institutional Context

- **Collaborating Organization:** Unified Mentor
- **3D Digital Heritage Reference:** CyArk (3D Heritage & LiDAR Laser Documentation)
- **Audio Storytelling Reference:** izi.TRAVEL (Location-Triggered Spatial Audio Guides)

Traditional heritage guides rely on printed brochures and static signboards, causing low visitor engagement, language barriers for international travelers, and static information delivery. The **Heritage Route Digital Guide Platform** transforms cultural tourism into a dynamic, personalized, and interactive journey. 

Tourists explore ancient routes via mobile devices, unlocking 3D monument visualizations, historical character voices, evolutionary timelines, and GPS-geofenced spatial narratives.

---

## 🏗️ System Architecture

```
                       ┌──────────────────────────────────────────────┐
                       │          Tourist Mobile Web Browser          │
                       └──────────────────────┬───────────────────────┘
                                              │ HTTP / JSON / SPA Hash
                                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               Heritage Route Frontend (SPA)                            │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌────────────────────────────┐  │
│  │   Interactive Map     │  │  WebAR 3D LiDAR Engine│  │     izi.TRAVEL Audio Dock  │  │
│  │ (Canvas Vector, GPS)  │  │ (Procedural 3D WebGL) │  │   (Web Speech Synthesis)   │  │
│  └───────────────────────┘  └───────────────────────┘  └────────────────────────────┘  │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌────────────────────────────┐  │
│  │  Historical Timeline  │  │  Character Dialogues  │  │    Digital Passport / QR   │  │
│  │  ("Then & Now" Slide) │  │  (Vespasian, ShahJahan)│ │    (Stamps, Certificates) │  │
│  └───────────────────────┘  └───────────────────────┘  └────────────────────────────┘  │
└─────────────────────────────────────────────┬──────────────────────────────────────────┘
                                              │ REST API (Bearer Token Auth)
                                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Express 5.2.1 REST API Backend                            │
│  ┌────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐  │
│  │    Auth & Sessions     │  │   Routes & Landmarks    │  │    Passport & Visits    │  │
│  │ (Tourist / Admin RBAC) │  │  (Geo, 3D, Timelines)   │  │  (Stamps & Favorites)   │  │
│  └────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘  │
│  ┌────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐  │
│  │    Admin CMS Panel     │  │   Visitor Analytics     │  │  Multilingual Dict (x6) │  │
│  │ (Create / Edit Trails) │  │ (Real-Time Telemetry)   │  │  (EN, ES, FR, HI, IT, JA│  │
│  └────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────┬──────────────────────────────────────────┘
                                              │ Atomic JSON File Sync
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │        Persistent Database File Storage      │
                       │             (data/database.json)             │
                       └──────────────────────────────────────────────┘
```

---

## 🚀 Key Features Matrix (8 Interconnected Modules)

| Module | Route Hash | Key Capabilities |
|---|---|---|
| **1. Route Explorer** | `#/routes` | Browse 4 corridors across Rome, Delhi/Agra, Kyoto, and Cairo. Filter by region, difficulty, duration, and UNESCO badges. Debounced keyword search. |
| **2. Interactive Route Map** | `#/map` | Vector canvas with Mercator projection. 3 visual map layers (Antique Parchment, LiDAR Dark, Satellite). Real-time GPS distance calculation (Haversine formula). **Simulate GPS Walker** with speed controls ($1x, 3x, 10x$) and automatic $200m$ geofenced story unlock. |
| **3. Landmark Storytelling** | `#/landmark/:id` | **Then & Now Slider** comparing historical archive sketches against modern conservation. Chronological evolutionary timeline. Interactive branching character dialogues with speech synthesis. |
| **4. WebAR & 3D Visualization** | `#/ar/:id` | WebGL 3D architectural engine. 3 render modes (**Realistic 3D**, **CyArk LiDAR Point Cloud** with moving laser scanlines, **Blueprint Wireframe**). Structural layer dissection/explode slider, live camera feed toggle, QR marker scanner, and AR snapshot photo capture. |
| **5. Physical QR Marker Plaque** | Modal | Generates authentic museum placard with crisp vector SVG QR code. Point mobile camera at plaque or click *Simulate Instant Scan Trigger* to unlock hidden chronicles. |
| **6. Tourist Passport** | `#/passport` | Gamified leather-bound passport with gold-leaf seals. Unlocks wax stamps upon visiting monuments, tracks corridor progress %, and generates a downloadable **Official UNESCO Certificate of Exploration**. |
| **7. Spatial Audio Tour** | Persistent Dock | izi.TRAVEL-style floating audio bar persisting across page transitions. Play/Pause, $\pm 15s$ skip, scrubber, speed control ($0.75x - 1.5x$), and live synchronized transcript highlights. |
| **8. Admin CMS & Analytics** | `#/admin` & `#/analytics` | Role-protected curator CMS for adding/editing routes, coordinates, 3D model geometry parameters, audio scripts, and multilingual translations. Real-time KPI charts and live visitor activity stream. |

---

## 🏛️ Authentic Heritage Corridors

1. **Imperial Rome: The Flavian & Forum Antiquity Trail (Rome, Italy)**
   - *The Colosseum* (72–80 AD) • *Roman Forum & Arch of Titus* (81 AD) • *The Pantheon* (118–125 AD) • *Castel Sant'Angelo* (134–139 AD).
   - Historical Voice: **Emperor Vespasian** & **Emperor Hadrian**.
2. **The Golden Triangle: Mughal & Rajput Dynastic Path (Delhi & Agra, India)**
   - *Red Fort / Lal Qila* (1638–1648 AD) • *Taj Mahal* (1632–1653 AD) • *Humayun's Tomb* (1565–1572 AD) • *Qutb Minar* (1192–1220 AD).
   - Historical Voice: **Emperor Shah Jahan** & **Ustad Ahmad Lahori**.
3. **The Ancient Capital: Kyoto Imperial & Zen Temple Trail (Kyoto, Japan)**
   - *Kinkaku-ji / Golden Pavilion* (1397 AD) • *Fushimi Inari Taisha* (711 AD) • *Kiyomizu-dera* (778 AD).
   - Historical Voice: **Lady Murasaki Shikibu** & **Shogun Ashikaga Yoshimitsu**.
4. **The Pharaohs & Islamic Cairo Trail (Cairo & Giza, Egypt)**
   - *The Great Pyramid of Giza* (c. 2560 BC) • *The Great Sphinx* (c. 2500 BC) • *Mosque of Sultan Hassan* (1356–1363 AD).
   - Historical Voice: **Master Builder Hemiunu** & **Pharaoh Khafre**.

---

## 💻 Tech Stack

- **Frontend:** Vanilla modern JavaScript (ES6+), HTML5 Canvas, WebGL Shader Pipeline, Web Speech API (SpeechSynthesis), Web Audio API, WebXR/Camera Stream (`navigator.mediaDevices.getUserMedia`).
- **Styling:** Museum-grade responsive CSS3 with dark obsidian/gold design system (`Cinzel`, `Outfit`, `JetBrains Mono` typography).
- **Backend:** Node.js 18+, Express.js 5.2.1.
- **Data Persistence:** In-memory store with atomic JSON disk persistence (`data/database.json`).
- **Testing:** Automated in-memory verification test suite (17 assertions).

---

## 🛠️ Quickstart (Run Locally)

### Prerequisites
- Node.js v18 or higher
- npm v9 or higher

### Steps
```bash
# 1. Clone repository or navigate to directory
cd /Users/smarikagupta/.gemini/antigravity/scratch/heritage-route-guide

# 2. Install dependencies
npm install

# 3. Start production server
npm start
```

Open your browser at **[http://localhost:3000](http://localhost:3000)**.

### Run Automated Tests
```bash
npm test
```

---

## 🌐 1-Click Live Cloud Deployment Guide

The platform is completely self-contained and pre-configured for free cloud hosting:

### Option A: Render.com (Recommended - 1 Click)
1. Push this repository to GitHub or GitLab.
2. In [Render Dashboard](https://dashboard.render.com/), click **New** > **Blueprint**.
3. Select your repository. Render automatically reads `render.yaml`:
   - Build Command: `npm install`
   - Start Command: `node server.js`
4. Click **Apply**. Your app is live with free HTTPS (e.g. `https://heritage-route.onrender.com`).

### Option B: Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project root.
3. The included `vercel.json` automatically deploys `server.js` as a serverless function with static asset routing.

### Option C: Railway or Heroku
1. Push to GitHub and connect repository to [Railway.app](https://railway.app/).
2. Railway detects `Procfile` (`web: node server.js`) and deploys automatically.

### Option D: Docker
```bash
docker build -t heritage-guide .
docker run -p 3000:3000 heritage-guide
```

---

## 🔑 Demo Credentials

| Role | Email | Password | Access Level |
|---|---|---|---|
| **Tourist** | `tourist@heritage.org` | `tourist123` | Route browsing, GPS walks, AR camera mode, audio tours, passport stamps & certificate generation. |
| **Chief Curator (Admin)** | `admin@heritage.org` | `admin123` | Route CRUD, monument 3D config, audio scripts, multilingual translation management, analytics. |

*(Quick-login buttons are also provided directly on the sign-in modal for 1-click access without typing).*

---

## 📜 REST API Reference

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/login` | Authenticate user & return token | No |
| `POST` | `/api/auth/register` | Register new tourist or curator | No |
| `GET` | `/api/auth/me` | Fetch active user session | Yes |
| `GET` | `/api/routes` | List all corridors (supports `?city=`, `?search=`) | No |
| `GET` | `/api/routes/:id` | Get route with populated waypoints | No |
| `POST` | `/api/routes` | Create new route (Admin) | Yes (Admin) |
| `PUT` | `/api/routes/:id` | Update route (Admin) | Yes (Admin) |
| `DELETE` | `/api/routes/:id` | Delete route (Admin) | Yes (Admin) |
| `GET` | `/api/landmarks` | List all historical monuments | No |
| `GET` | `/api/landmarks/:id` | Get landmark, 3D config & timeline | No |
| `POST` | `/api/landmarks` | Create new landmark (Admin) | Yes (Admin) |
| `POST` | `/api/landmarks/:id/visit` | Stamp monument in user passport | Yes |
| `POST` | `/api/landmarks/:id/favorite` | Toggle landmark bookmark | Yes |
| `GET` | `/api/user/passport` | Get passport stamps & explorer badges | Yes |
| `GET` | `/api/qr/lookup/:code` | Resolve physical QR marker string | No |
| `GET` | `/api/analytics` | Get visitor KPIs & route metrics | No |
| `POST` | `/api/analytics/event` | Log AR interaction or audio event | No |
| `GET` | `/api/translations/:lang` | Fetch localized UI strings (EN, ES, FR, HI, IT, JA) | No |
| `PUT` | `/api/translations/:lang` | Update translation dictionary (Admin) | Yes (Admin) |

---

## 🧪 Verification Results

All 17 end-to-end tests pass cleanly:

```
  ✓ PASS: GET /api/routes returns route array
  ✓ PASS: Found 6 Heritage Routes
  ✓ PASS: GET /api/routes/:id populates complete landmark details and waypoints
  ✓ PASS: Found 16 Historical Monuments
  ✓ PASS: GET /api/landmarks/:id returns character dialog & timeline
  ✓ PASS: GET /api/qr/lookup/:code resolves physical monument marker
  ✓ PASS: POST /api/auth/login authorizes tourist Marco Rossi
  ✓ PASS: GET /api/auth/me confirms tourist session
  ✓ PASS: POST /api/landmarks/:id/visit stamps Taj Mahal in passport
  ✓ PASS: POST /api/landmarks/:id/favorite toggles bookmark state
  ✓ PASS: GET /api/user/passport awards explorer badges
  ✓ PASS: GET /api/analytics tracks KPIs and route popularity
  ✓ PASS: GET /api/translations/es provides Spanish localization
  ✓ PASS: GET /api/translations/hi provides Hindi localization
  ✓ PASS: POST /api/auth/login authorizes Lead Curator Dr. Finch
  ✓ PASS: Admin POST /api/routes creates new heritage walking trail
  ✓ PASS: Admin POST /api/landmarks registers monument with 3D model configuration

FINAL RESULT: ALL 17 VERIFICATION TESTS PASSED (0 FAILED)
```

---

## 👥 Contributors & Institutional Attribution
- **Unified Mentor** (Collaborating Organization & Educational Mentorship)
- **CyArk** (Digital Heritage 3D Documentation Reference)
- **izi.TRAVEL** (Audio Guide & Location Storytelling Reference)
