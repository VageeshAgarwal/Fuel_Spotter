# ⛽ Fuel Spotter — Pro Edition

### Final Year Engineering Project | React + Node.js + MongoDB + Leaflet

> **Problem Statement:** Travellers on Indian National Highways struggle to locate nearby petrol pumps, especially in unfamiliar regions. Fuel Spotter provides real-time geolocation-based discovery of petrol pumps across all fuel types with an interactive map, offline-ready filters, multi-language support, and a community review system.

---

## 🎯 Project Highlights

| Feature                      | Technology                           |
| ---------------------------- | ------------------------------------ |
| GPS + Manual Location        | Browser Geolocation API              |
| NH Highway Search            | OpenStreetMap Overpass API           |
| Interactive Map + Routing    | Leaflet.js + OSRM (free, no API key) |
| Fuel Type Filters            | Overpass QL tag filtering            |
| Reviews & Ratings            | MongoDB + Express REST API           |
| Favorites / Bookmarks        | localStorage + MongoDB sync          |
| Multi-Language (EN/HI/MR/TA) | react-i18next                        |
| Dark / Light Mode            | CSS custom properties                |
| Real-time Availability       | Mock → IOC/HPCL/BPCL API ready       |
| Responsive Design            | CSS Grid + Flexbox                   |

---

## 🗂️ Folder Structure

```
Fuel_Spotter/
├── client/                          ← React frontend
│   ├── public/
│   └── src/
│       ├── pages/
│       │   └── Home.jsx             ← Main page (GPS, NH search, cards grid)
│       ├── components/
│       │   ├── Navbar.jsx           ← Top navigation bar
│       │   └── ReviewModal.jsx      ← Ratings + reviews popup
│       ├── i18n/
│       │   └── i18n.js              ← Translations: EN, HI, MR, TA
│       ├── hooks/
│       │   ├── useGeolocation.js    ← GPS hook (extract from Home)
│       │   └── useOverpass.js       ← Overpass fetch hook (extract from Home)
│       ├── utils/
│       │   ├── distance.js          ← Haversine formula
│       │   └── brandColors.js       ← IOC/BPCL/HPCL brand mapping
│       └── index.js                 ← Entry point (import './i18n/i18n' here)
│
├── server/                          ← Node.js + Express backend
│   ├── models/
│   │   ├── Review.js                ← Mongoose review model
│   │   └── Favorite.js              ← Mongoose favorite model
│   ├── routes/
│   │   ├── reviews.js               ← Review CRUD routes
│   │   ├── favorites.js             ← Favorites toggle routes
│   │   └── availability.js          ← Fuel availability routes
│   ├── middleware/
│   │   └── rateLimit.js             ← Simple rate limiter
│   ├── index.js                     ← App entry point (all routes merged here)
│   └── .env                         ← MongoDB URI, ports, secrets
│
├── package.json                     ← Root scripts
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- MongoDB (local or Atlas free tier)
- npm or yarn

### 1. Clone & Install

```bash
git clone https://github.com/VageeshAgarwal/Fuel_Spotter.git
cd Fuel_Spotter

# Install client
cd client && npm install

# Install server
cd ../server && npm install
```

### 2. Install new packages

```bash
# Frontend (in /client)
npm install leaflet react-leaflet react-i18next i18next i18next-browser-languagedetector react-icons

# Backend (in /server)
npm install express cors mongoose dotenv helmet morgan
```

### 3. Configure environment

Create `server/.env`:

```env
PORT=5000
CLIENT_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/fuelspotter
ADMIN_KEY=your-secret-key
```

### 4. Run both servers

```bash
# Terminal 1 — Backend
cd server && node index.js

# Terminal 2 — Frontend
cd client && npm start
```

---

## 🗺️ API Reference

### Reviews

```
GET    /api/reviews/:pumpId        Returns reviews + avgRating + distribution
POST   /api/reviews                Body: { pumpId, name?, rating, text }
DELETE /api/reviews/:id            Header: x-admin-key required
```

### Favorites

```
GET    /api/favorites/:sessionId   Returns user's saved pumps
POST   /api/favorites/toggle       Body: { sessionId, pumpId, pumpName? }
```

### Availability

```
GET    /api/availability/:pumpId   Returns { petrol, diesel, cng, lpg, ev }
```

### Health

```
GET    /api/health                 Returns service status + DB connection state
GET    /api/stats                  Returns review counts, top-rated pumps
```

---

## 🔧 Key Technical Decisions

### Why Leaflet instead of Google Maps?

- **Free**: No API key, no billing, no usage limits
- **Open data**: OpenStreetMap data is community-maintained and accurate in India
- **OSRM routing**: Free turn-by-turn routing API, no key needed
- **CartoDB dark tiles**: Beautiful dark mode map tiles

### Why Overpass API instead of a database?

- Petrol pump data is already crowdsourced in OpenStreetMap
- Overpass queries allow real-time, always-fresh data
- Multiple mirrors prevent single points of failure
- NH highway search uses bounding-box queries for 20+ major highways

### Data flow

```
User Location (GPS)
       ↓
Overpass API Query (5km radius OR NH bounding box)
       ↓
Enrichment (distance calc, fuel tag parsing, mock availability)
       ↓
React State → Filter + Sort → Card Grid + Leaflet Map
       ↓
User actions → Reviews/Favorites → MongoDB (via Express API)
```

---

## 🌐 Multi-Language Support

Languages implemented: **English, Hindi (हिंदी), Marathi (मराठी), Tamil (தமிழ்)**

To add a new language:

1. Add a new key in `src/i18n/i18n.js` under `resources`
2. Translate all ~45 strings
3. Add the language to the `LANGS` array in `Home.jsx`

---

## 📈 Future Enhancements (for viva)

1. **Real availability API** — Integrate IOC SmartFuel / HPCL Urja app data
2. **Push notifications** — Alert when a saved pump restores availability
3. **Progressive Web App** — Offline caching with service workers
4. **Crowd reporting** — Users can flag incorrect pump info
5. **Price tracking** — Daily petrol/diesel price data from government portals
6. **Cluster markers** — Group nearby pins at low zoom levels
7. **Authentication** — JWT-based login to tie reviews to accounts
8. **Admin dashboard** — Moderate reviews, view stats

---

## 📊 System Architecture Diagram

```
┌─────────────────────────────────────────┐
│           React Frontend                │
│  Home.jsx → Leaflet Map → Review Modal  │
│  i18n (EN/HI/MR/TA) + Dark Mode        │
└───────────┬───────────────┬─────────────┘
            │               │
    Overpass API      Express REST API
    (OSM data)        (localhost:5000)
            │               │
    Fuel station       MongoDB Atlas
    data (live)     (reviews, favorites)
```

---

## 🎓 Project Information

- **Project Title:** Fuel Spotter — National Highway Petrol Pump Finder
- **Problem Statement:** Real-time discovery of petrol pumps on Indian National Highways
- **Domain:** Web Application / GIS / Location-Based Services
- **Tech Stack:** React, Node.js, Express, MongoDB, Leaflet, Overpass API, OSRM
- **Data Source:** OpenStreetMap (open data, always up-to-date)
- **Deployment:** Vercel (frontend) + Railway/Render (backend) + MongoDB Atlas

---

_Built with React + Leaflet + OpenStreetMap. No paid APIs required._
