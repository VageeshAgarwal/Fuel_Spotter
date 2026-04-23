/**
 *  ✅ GPS + Manual Coordinate Entry
 *  ✅ Place / City name search  → Nominatim geocoding (free, no key)
 *  ✅ Radius selector  (1 km → 2 → 5 → 10 → 25 → 50 km)
 *  ✅ NH Highway Search
 *  ✅ Leaflet Map with OSRM routing (radius circle shown on map)
 *  ✅ Fuel Type Filters (Petrol / Diesel / CNG / LPG / EV)
 *  ✅ Live name filter on results
 *  ✅ Reviews & Star Ratings  (localStorage + REST API ready)
 *  ✅ Favorites / Bookmarks
 *  ✅ Real-time availability mock
 *  ✅ Sort: Nearest / Highest Rated / Name
 *  ✅ Distance + ETA
 *  ✅ Multi-language: EN / HI / MR / TA
 *  ✅ Dark / Light Mode
 *  ✅ Shimmer skeleton loading
 *  ✅ Responsive layout
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  Circle,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTranslation } from "react-i18next";
import "../i18n";
import Navbar from "../components/Navbar";
import ReviewModal from "../components/ReviewModal";

// ── Fix Leaflet default icons (Webpack / Vite) ────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ════════════════════════════════════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════════════════════════════════════

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371,
    toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR,
    dLon = (lon2 - lon1) * toR;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estTime(km) {
  const mins = Math.round((km / 30) * 60);
  return mins < 60 ? `~${mins} min` : `~${(mins / 60).toFixed(1)} hr`;
}

// ── Overpass mirrors ──────────────────────────────────────────────────────────
const MIRRORS = [
  "https://overpass.openstreetmap.ru/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
export async function fetchOverpass(query) {
  for (const url of MIRRORS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        body: query,
        signal: AbortSignal.timeout(30000),
      });
      if (r.ok) return r.json();
    } catch {
      /* try next */
    }
  }
  throw new Error("All Overpass mirrors failed");
}

// ── Nominatim geocoder (free, no API key, OSM-based) ─────────────────────────
export async function geocodePlace(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=in`;
  const r = await fetch(url, {
    headers: { "Accept-Language": "en", "User-Agent": "FuelSpotter/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error("Geocoding failed");
  return r.json();
}

// ── Radius options (value = metres for Overpass) ──────────────────────────────
export const RADIUS_OPTIONS = [
  { label: "1 km", value: 1000 },
  { label: "2 km", value: 2000 },
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
  { label: "25 km", value: 25000 },
  { label: "50 km", value: 50000 },
];

// ── Fuel definitions ──────────────────────────────────────────────────────────
export const FUEL_DEFS = [
  {
    key: "petrol",
    label: "Petrol",
    icon: "⛽",
    color: "#f97316",
    tags: ["fuel:petrol", "fuel:octane_91", "fuel:octane_95", "fuel:unleaded"],
  },
  {
    key: "diesel",
    label: "Diesel",
    icon: "🛢️",
    color: "#3b82f6",
    tags: ["fuel:diesel"],
  },
  {
    key: "cng",
    label: "CNG",
    icon: "💨",
    color: "#10b981",
    tags: ["fuel:cng"],
  },
  {
    key: "lpg",
    label: "LPG",
    icon: "🔵",
    color: "#8b5cf6",
    tags: ["fuel:lpg"],
  },
  {
    key: "ev",
    label: "EV",
    icon: "⚡",
    color: "#f59e0b",
    tags: ["fuel:electric", "amenity:charging_station"],
  },
];
export function getFuels(tags = {}) {
  return FUEL_DEFS.filter(({ tags: t }) =>
    t.some((k) => tags[k] === "yes"),
  ).map((f) => f.key);
}

// ── Brand colors ──────────────────────────────────────────────────────────────
const BRAND_COLORS = {
  "indian oil": "#e63946",
  iocl: "#e63946",
  bpcl: "#2563eb",
  "bharat petroleum": "#2563eb",
  hpcl: "#16a34a",
  "hindustan petroleum": "#16a34a",
  essar: "#dc2626",
  shell: "#f59e0b",
  reliance: "#7c3aed",
  nayara: "#0ea5e9",
};
export function brandColor(name = "") {
  const l = name.toLowerCase();
  for (const [k, v] of Object.entries(BRAND_COLORS))
    if (l.includes(k)) return v;
  return "#f97316";
}

// ── NH bounding boxes ─────────────────────────────────────────────────────────
export const NH_BOUNDS = {
  NH1: [28.5, 74.8, 32.2, 76.8],
  NH2: [22.5, 77.1, 28.6, 88.3],
  NH3: [18.9, 72.8, 22.7, 75.8],
  NH4: [12.9, 73.9, 18.9, 77.5],
  NH5: [13.0, 79.9, 20.2, 85.8],
  NH6: [21.1, 73.8, 22.5, 88.3],
  NH7: [8.0, 77.5, 22.7, 79.9],
  NH8: [12.9, 77.1, 28.6, 77.5],
  NH17: [8.5, 73.8, 15.3, 76.9],
  NH24: [26.8, 77.2, 28.6, 80.9],
  NH27: [22.0, 70.0, 26.9, 88.0],
  NH30: [20.0, 73.0, 25.5, 82.5],
  NH44: [8.1, 76.6, 37.1, 77.5],
  NH48: [12.9, 77.1, 28.6, 77.5],
  NH52: [26.0, 76.0, 33.0, 88.0],
  NH53: [17.5, 73.0, 23.0, 86.5],
  NH58: [28.6, 77.2, 30.7, 79.1],
  NH66: [8.5, 72.8, 19.1, 76.9],
  NH75: [22.5, 75.5, 26.5, 84.0],
  NH76: [22.0, 74.0, 26.5, 83.0],
  NH85: [24.0, 84.0, 28.5, 88.5],
  NH87: [29.0, 77.5, 30.7, 80.0],
  NH150: [20.0, 81.0, 26.0, 86.0],
  NH160: [16.5, 74.5, 18.5, 77.0],
};

// ── Mock availability ─────────────────────────────────────────────────────────
const AVAIL = ["available", "available", "limited", "available", "unavailable"];
export function mockAvail(id) {
  const seed = String(id)
    .split("")
    .reduce((s, c) => s + c.charCodeAt(0), 0);
  return AVAIL[seed % AVAIL.length];
}

// ── Custom Leaflet pin ────────────────────────────────────────────────────────
export function pinIcon(color, size = 32) {
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;background:${color};border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 10px rgba(0,0,0,0.4)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  MAP CHILD COMPONENTS
// ════════════════════════════════════════════════════════════════════════════
function RecenterMap({ lat, lng, zoom = 13 }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom);
  }, [lat, lng, zoom, map]);
  return null;
}

function RouteLayer({ userLoc, dest, onRouteInfo }) {
  const map = useMap();
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      map.removeLayer(ref.current);
      ref.current = null;
    }
    if (!userLoc || !dest) return;
    const url = `https://router.project-osrm.org/route/v1/driving/${userLoc.lng},${userLoc.lat};${dest.lon},${dest.lat}?overview=full&geometries=geojson`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.routes?.[0]) {
          const route = data.routes[0];
          const coords = route.geometry.coordinates.map(([lng, lat]) => [
            lat,
            lng,
          ]);
          ref.current = L.polyline(coords, {
            color: "#f97316",
            weight: 5,
            opacity: 0.85,
          }).addTo(map);
          map.fitBounds(ref.current.getBounds(), { padding: [60, 60] });
          onRouteInfo?.({
            distance: (route.distance / 1000).toFixed(1),
            duration: Math.round(route.duration / 60),
          });
        }
      })
      .catch(() => {
        ref.current = L.polyline(
          [
            [userLoc.lat, userLoc.lng],
            [dest.lat, dest.lon],
          ],
          { color: "#f97316", weight: 3, dashArray: "10 6", opacity: 0.6 },
        ).addTo(map);
      });
    return () => {
      if (ref.current) map.removeLayer(ref.current);
    };
  }, [userLoc, dest, map, onRouteInfo]);
  return null;
}

// ════════════════════════════════════════════════════════════════════════════
//  SKELETON CARD
// ════════════════════════════════════════════════════════════════════════════
function SkeletonCard() {
  return (
    <div style={cs.card}>
      {[
        [65, 16],
        [45, 12],
        [80, 10],
        [30, 10],
      ].map(([w, h], i) => (
        <div
          key={i}
          style={{ ...cs.skel, width: `${w}%`, height: h, marginBottom: 10 }}
        />
      ))}
      <div
        style={{
          ...cs.skel,
          width: "100%",
          height: 40,
          borderRadius: 10,
          marginTop: 6,
        }}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  SEARCH BAR  (place search + radius pills)
//  — Standalone component so state is clean
// ════════════════════════════════════════════════════════════════════════════
function SearchBar({ th, radius, setRadius, onSearch, loading }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggLoading, setSuggLoading] = useState(false);
  const [showSugg, setShowSugg] = useState(false);
  const debounceRef = useRef(null);

  // Debounced autocomplete  (400 ms)
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setSuggestions([]);
      setShowSugg(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSuggLoading(true);
      try {
        const results = await geocodePlace(query);
        setSuggestions(results.slice(0, 5));
        setShowSugg(results.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggLoading(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSelect = (place) => {
    setQuery(place.display_name.split(",")[0]);
    setSuggestions([]);
    setShowSugg(false);
    onSearch({ lat: parseFloat(place.lat), lng: parseFloat(place.lon) });
  };

  const handleSearchClick = async () => {
    if (query.trim().length < 2) return;
    try {
      const results = await geocodePlace(query);
      if (results[0]) handleSelect(results[0]);
    } catch {
      /* silent */
    }
  };

  return (
    <div>
      {/* Section label */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: th.textFaint,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          marginBottom: 10,
        }}
      >
        Search by Place + Radius
      </div>

      {/* Input row */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {/* Place input */}
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <input
            style={{
              ...cs.input,
              width: "100%",
              paddingLeft: 38,
              paddingRight: suggLoading ? 36 : 12,
              background: th.inputBg,
              borderColor: th.border,
              color: th.text,
              height: 44,
              fontSize: 14,
            }}
            placeholder="City, town or highway junction…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearchClick();
              if (e.key === "Escape") setShowSugg(false);
            }}
            onBlur={() => setTimeout(() => setShowSugg(false), 200)}
            onFocus={() => suggestions.length > 0 && setShowSugg(true)}
            autoComplete="off"
          />

          {/* Pin icon inside input */}
          <span
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 15,
              pointerEvents: "none",
            }}
          >
            📍
          </span>

          {/* Spinner */}
          {suggLoading && (
            <div
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                width: 14,
                height: 14,
                border: "2px solid #f97316",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 0.6s linear infinite",
              }}
            />
          )}

          {/* Autocomplete dropdown */}
          {showSugg && suggestions.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                right: 0,
                background: th.card,
                border: `1px solid ${th.border}`,
                borderRadius: 12,
                zIndex: 400,
                boxShadow: "0 12px 40px #0009",
                overflow: "hidden",
              }}
            >
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  onMouseDown={() => handleSelect(s)}
                  style={{
                    padding: "10px 14px",
                    cursor: "pointer",
                    borderBottom:
                      i < suggestions.length - 1
                        ? `1px solid ${th.border}`
                        : "none",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#f9731614")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: th.text,
                      marginBottom: 2,
                    }}
                  >
                    📌 {s.display_name.split(",")[0]}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: th.textFaint,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {s.display_name.split(",").slice(1, 4).join(",")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search button */}
        <button
          onClick={handleSearchClick}
          disabled={loading || query.trim().length < 2}
          style={{
            ...cs.btnOrange,
            height: 44,
            padding: "0 22px",
            opacity: loading || query.trim().length < 2 ? 0.5 : 1,
            cursor:
              loading || query.trim().length < 2 ? "not-allowed" : "pointer",
            flexShrink: 0,
          }}
        >
          {loading ? "⏳" : "🔍"} Search
        </button>

        {/* Clear button */}
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setSuggestions([]);
              setShowSugg(false);
            }}
            style={{
              ...cs.btnGhost,
              height: 44,
              padding: "0 14px",
              borderColor: th.border,
              color: th.textSub,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Radius pills */}
      <div
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "center",
          gap: 7,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: th.textFaint,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          📡 Radius:
        </span>

        {RADIUS_OPTIONS.map((opt) => {
          const active = radius === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setRadius(opt.value)}
              style={{
                padding: "5px 13px",
                borderRadius: 20,
                border: `1.5px solid ${active ? "#f97316" : th.border}`,
                background: active ? "#f97316" : th.card,
                color: active ? "#fff" : th.textSub,
                fontSize: 12,
                fontWeight: active ? 700 : 400,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              {opt.label}
            </button>
          );
        })}

        {/* Radius progress bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginLeft: 4,
          }}
        >
          <div
            style={{
              width: 72,
              height: 4,
              background: th.border,
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                background: "#f97316",
                borderRadius: 2,
                width: `${((RADIUS_OPTIONS.findIndex((o) => o.value === radius) + 1) / RADIUS_OPTIONS.length) * 100}%`,
                transition: "width 0.25s ease",
              }}
            />
          </div>
          <span
            style={{
              fontSize: 11,
              color: "#f97316",
              fontWeight: 700,
              minWidth: 36,
            }}
          >
            {radius / 1000} km
          </span>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════
export default function Home() {
  const { t, i18n } = useTranslation();

  // ── Location ──────────────────────────────────────────────────────────────
  const [location, setLocation] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [locError, setLocError] = useState("");
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [showManual, setShowManual] = useState(false);

  // ── Search + Radius ───────────────────────────────────────────────────────
  const [radius, setRadius] = useState(5000); // metres
  const [searchLoc, setSearchLoc] = useState(null); // geocoded centre

  // ── NH search ─────────────────────────────────────────────────────────────
  const [nhInput, setNhInput] = useState("");
  const [nhActive, setNhActive] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [pumps, setPumps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // ── Filters / sort ────────────────────────────────────────────────────────
  const [fuelFilter, setFuelFilter] = useState([]);
  const [sortBy, setSortBy] = useState("distance");
  const [showFavs, setShowFavs] = useState(false);
  const [nameFilter, setNameFilter] = useState(""); // card-level text filter

  // ── Reviews & favorites ───────────────────────────────────────────────────
  const [reviews, setReviews] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("fs_reviews") || "{}");
    } catch {
      return {};
    }
  });
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("fs_favs") || "[]");
    } catch {
      return [];
    }
  });
  const [reviewModal, setReviewModal] = useState(null);

  // ── UI ────────────────────────────────────────────────────────────────────
  const [dark, setDark] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [routeDest, setRouteDest] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [showLangMenu, setShowLangMenu] = useState(false);

  // ── Persist ───────────────────────────────────────────────────────────────
  useEffect(
    () => localStorage.setItem("fs_reviews", JSON.stringify(reviews)),
    [reviews],
  );
  useEffect(
    () => localStorage.setItem("fs_favs", JSON.stringify(favorites)),
    [favorites],
  );

  // ── GPS watch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocError(t("geo_not_supported"));
      setShowManual(true);
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(Math.round(pos.coords.accuracy));
        setLocError("");
        if (pos.coords.accuracy < 80) navigator.geolocation.clearWatch(id);
      },
      (err) => {
        const msg = {
          1: t("geo_denied"),
          2: t("geo_unavail"),
          3: t("geo_timeout"),
        };
        setLocError(msg[err.code] || t("geo_error"));
        setShowManual(true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []); // eslint-disable-line

  // ── Build Overpass query (uses dynamic radius) ────────────────────────────
  const buildQuery = useCallback(
    (target, bbox, rad) => {
      const r = rad ?? radius;
      const fuelTags = fuelFilter.length
        ? fuelFilter
            .flatMap((k) => FUEL_DEFS.find((f) => f.key === k)?.tags || [])
            .map((tag) => `["${tag}"="yes"]`)
            .join("")
        : "";
      if (bbox) {
        const [s, w, n, e] = bbox;
        return `[out:json][timeout:60];(node(${s},${w},${n},${e})["amenity"="fuel"]${fuelTags};way(${s},${w},${n},${e})["amenity"="fuel"]${fuelTags};);out center tags;`;
      }
      return `[out:json][timeout:50];(node(around:${r},${target.lat},${target.lng})["amenity"="fuel"]${fuelTags};way(around:${r},${target.lat},${target.lng})["amenity"="fuel"]${fuelTags};relation(around:${r},${target.lat},${target.lng})["amenity"="fuel"]${fuelTags};);out center tags;`;
    },
    [fuelFilter, radius],
  );

  // ── Fetch pumps ───────────────────────────────────────────────────────────
  const fetchPumps = useCallback(
    async (loc, bbox, rad) => {
      const target = loc || searchLoc || location;
      if (!target && !bbox) return;
      setLoading(true);
      setFetchError("");
      setPumps([]);
      try {
        const data = await fetchOverpass(buildQuery(target, bbox, rad));
        const enriched = (data.elements || [])
          .map((p) => {
            const lat = p.lat ?? p.center?.lat;
            const lon = p.lon ?? p.center?.lon;
            if (!lat || !lon) return null;
            return {
              ...p,
              lat,
              lon,
              distance: target
                ? haversineKm(target.lat, target.lng, lat, lon)
                : null,
              fuels: getFuels(p.tags),
              avail: mockAvail(p.id),
            };
          })
          .filter(Boolean)
          .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
        setPumps(enriched);
        if (!enriched.length) setFetchError(t("no_pumps_found"));
      } catch {
        setFetchError(t("servers_unreachable"));
      } finally {
        setLoading(false);
      }
    },
    [location, searchLoc, buildQuery, t],
  );

  // Fetch when GPS arrives for the first time
  useEffect(() => {
    if (location && !searchLoc) fetchPumps(location);
  }, [location]); // eslint-disable-line

  // Re-fetch when radius changes (only if we have a centre, not NH mode)
  useEffect(() => {
    const target = searchLoc || location;
    if (target && !nhActive) fetchPumps(target, undefined, radius);
  }, [radius]); // eslint-disable-line

  // ── Search bar handler ────────────────────────────────────────────────────
  const handlePlaceSearch = useCallback(
    (loc) => {
      setSearchLoc(loc);
      setNhActive(false);
      setNhInput("");
      fetchPumps(loc, undefined, radius);
    },
    [radius, fetchPumps],
  );

  // ── NH search ─────────────────────────────────────────────────────────────
  const handleNhSearch = () => {
    const key = nhInput.trim().toUpperCase().replace(/\s+/g, "");
    const bbox = NH_BOUNDS[key];
    if (!bbox) {
      setFetchError(`${t("nh_not_found")}: ${key}`);
      return;
    }
    setNhActive(true);
    setSearchLoc(null);
    fetchPumps(null, bbox);
  };

  // ── Manual coords ─────────────────────────────────────────────────────────
  const handleManualSubmit = () => {
    const lat = parseFloat(manualLat),
      lng = parseFloat(manualLng);
    if (
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    )
      return;
    const loc = { lat, lng };
    setLocation(loc);
    setSearchLoc(null);
    setNhActive(false);
    fetchPumps(loc, undefined, radius);
  };

  // ── Favorites ─────────────────────────────────────────────────────────────
  const toggleFav = (id) =>
    setFavorites((p) =>
      p.includes(id) ? p.filter((f) => f !== id) : [...p, id],
    );

  // ── Reviews ───────────────────────────────────────────────────────────────
  const submitReview = (pump, review) => {
    setReviews((p) => ({ ...p, [pump.id]: [review, ...(p[pump.id] || [])] }));
  };
  const avgRating = (id) => {
    const r = reviews[id] || [];
    return r.length ? r.reduce((s, x) => s + x.rating, 0) / r.length : 0;
  };

  // ── Filtered + sorted list ────────────────────────────────────────────────
  const displayed = [...pumps]
    .filter(
      (p) =>
        fuelFilter.length === 0 || fuelFilter.every((k) => p.fuels.includes(k)),
    )
    .filter((p) => !showFavs || favorites.includes(p.id))
    .filter((p) => {
      if (!nameFilter.trim()) return true;
      const q = nameFilter.toLowerCase();
      return (
        (p.tags?.name || "").toLowerCase().includes(q) ||
        (p.tags?.brand || "").toLowerCase().includes(q) ||
        (p.tags?.operator || "").toLowerCase().includes(q) ||
        (p.tags?.["addr:city"] || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === "rating") return avgRating(b.id) - avgRating(a.id);
      if (sortBy === "name")
        return (a.tags?.name || "").localeCompare(b.tags?.name || "");
      return (a.distance ?? 999) - (b.distance ?? 999);
    });

  // ── Theme + languages ─────────────────────────────────────────────────────
  const th = dark ? DARK : LIGHT;
  const LANGS = [
    { code: "en", label: "EN", native: "English" },
    { code: "hi", label: "HI", native: "हिंदी" },
    { code: "mr", label: "MR", native: "मराठी" },
    { code: "ta", label: "TA", native: "தமிழ்" },
  ];

  const availStyle = {
    available: { color: "#4ade80", bg: "#16a34a18", border: "#16a34a40" },
    limited: { color: "#fb923c", bg: "#f9731618", border: "#f9731640" },
    unavailable: { color: "#f87171", bg: "#ef444418", border: "#ef444440" },
  };

  // Active centre for the map
  const mapCentre = searchLoc || location;
  // Zoom level tuned to radius
  const mapZoom =
    radius > 25000 ? 9 : radius > 10000 ? 10 : radius > 5000 ? 11 : 13;

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'DM Sans', sans-serif; }
        @keyframes shimmer  { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes fadeUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes spin     { to{transform:rotate(360deg)} }
        .fs-card { transition: transform 0.2s, border-color 0.2s; }
        .fs-card:hover { transform: translateY(-3px); }
        .fs-btn-primary:hover { filter: brightness(1.1); }
        .fs-chip:hover { border-color: #f97316 !important; color: #f97316 !important; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #374151; border-radius: 3px; }
        .leaflet-container { font-family: 'DM Sans', sans-serif !important; }
      `}</style>

      <Navbar
        dark={dark}
        setDark={setDark}
        showMap={showMap}
        setShowMap={setShowMap}
      />

      <div
        style={{
          background: th.bg,
          color: th.text,
          minHeight: "100vh",
          paddingBottom: 80,
          fontFamily: "'DM Sans', sans-serif",
          transition: "background 0.3s, color 0.3s",
        }}
      >
        {/* ── TOP BAR ──────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 8,
            padding: "14px 48px 0",
            flexWrap: "wrap",
          }}
        >
          {/* Language */}
          <div style={{ position: "relative" }}>
            {showLangMenu && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "110%",
                  background: th.card,
                  border: `1px solid ${th.border}`,
                  borderRadius: 12,
                  overflow: "hidden",
                  zIndex: 200,
                  minWidth: 130,
                  boxShadow: "0 8px 30px #0006",
                }}
              ></div>
            )}
          </div>
          <button
            onClick={() => setShowFavs((v) => !v)}
            style={{
              ...cs.topBtn,
              background: showFavs ? "#ef444422" : th.card,
              borderColor: showFavs ? "#ef4444" : th.border,
              color: showFavs ? "#ef4444" : th.textSub,
            }}
          >
            ❤️ {t("favorites")}{" "}
            {favorites.length > 0 && `(${favorites.length})`}
          </button>
        </div>

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <div
          style={{
            padding: "40px 48px 36px",
            borderBottom: `1px solid ${th.border}`,
            display: "flex",
            flexWrap: "wrap",
            gap: 36,
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          {/* Left column */}
          <div style={{ flex: 1, minWidth: 300, maxWidth: 660 }}>
            {/* Live badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#f9731618",
                border: "1px solid #f9731640",
                borderRadius: 30,
                padding: "4px 14px",
                marginBottom: 18,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  background: "#f97316",
                  borderRadius: "50%",
                  animation: "pulse 2s infinite",
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#f97316",
                  letterSpacing: 1.5,
                }}
              >
                LIVE • NATIONAL HIGHWAY FUEL FINDER
              </span>
            </div>

            <h1
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: "clamp(3rem,7vw,5.5rem)",
                fontWeight: 900,
                color: "#f97316",
                letterSpacing: "-1px",
                lineHeight: 0.95,
                marginBottom: 10,
              }}
            >
              FUEL
              <br />
              SPOTTER
            </h1>
            <p
              style={{
                fontSize: 16,
                color: th.textSub,
                marginBottom: 20,
                lineHeight: 1.6,
              }}
            >
              {t("tagline")}
            </p>
            <div
              style={{
                width: 56,
                height: 3,
                background: "linear-gradient(90deg,#f97316,#fbbf24)",
                borderRadius: 2,
                marginBottom: 28,
              }}
            />

            {/* ═══════════════════════════════════════════════════════════
                SEARCH CARD  (place + radius + NH)
            ═══════════════════════════════════════════════════════════ */}
            <div
              style={{
                background: th.card,
                border: `1px solid ${th.border}`,
                borderRadius: 20,
                padding: "22px 24px",
                marginBottom: 20,
                boxShadow: dark ? "0 4px 24px #0005" : "0 2px 16px #0001",
              }}
            >
              {/* Place + radius */}
              <SearchBar
                th={th}
                radius={radius}
                setRadius={setRadius}
                onSearch={handlePlaceSearch}
                loading={loading}
              />

              {/* Divider */}
              <div
                style={{
                  margin: "18px 0 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ flex: 1, height: 1, background: th.border }} />
                <span
                  style={{
                    fontSize: 11,
                    color: th.textFaint,
                    fontWeight: 600,
                    letterSpacing: 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  OR SEARCH BY NATIONAL HIGHWAY
                </span>
                <div style={{ flex: 1, height: 1, background: th.border }} />
              </div>

              {/* NH row */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <div style={{ position: "relative" }}>
                  <input
                    style={{
                      ...cs.input,
                      background: th.inputBg,
                      borderColor: th.border,
                      color: th.text,
                      paddingLeft: 34,
                      width: 150,
                      height: 42,
                    }}
                    placeholder="e.g. NH44"
                    value={nhInput}
                    onChange={(e) => setNhInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNhSearch()}
                    list="nh-list"
                  />
                  <datalist id="nh-list">
                    {Object.keys(NH_BOUNDS).map((k) => (
                      <option key={k} value={k} />
                    ))}
                  </datalist>
                  <span
                    style={{
                      position: "absolute",
                      left: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: 13,
                    }}
                  >
                    🛣️
                  </span>
                </div>
                <button
                  onClick={handleNhSearch}
                  className="fs-btn-primary"
                  style={{ ...cs.btnOrange, height: 42, padding: "0 18px" }}
                >
                  🔍 {t("search_nh")}
                </button>
                {nhActive && (
                  <button
                    onClick={() => {
                      setNhActive(false);
                      setNhInput("");
                      const tgt = searchLoc || location;
                      if (tgt) fetchPumps(tgt);
                    }}
                    style={{
                      ...cs.btnGhost,
                      height: 42,
                      borderColor: th.border,
                      color: th.textSub,
                    }}
                  >
                    ✕ {t("clear_nh")}
                  </button>
                )}
              </div>
            </div>

            {/* Location badge */}
            {(location || searchLoc) && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: th.card,
                  border: `1px solid ${th.border}`,
                  borderRadius: 24,
                  padding: "6px 16px",
                  marginBottom: 10,
                  fontSize: 12,
                }}
              >
                <span style={{ color: "#4ade80" }}>📍</span>
                <span style={{ color: th.textSub }}>
                  {searchLoc
                    ? `Search centre: ${searchLoc.lat.toFixed(4)}, ${searchLoc.lng.toFixed(4)}`
                    : `GPS: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}
                </span>
                {!searchLoc && accuracy !== null && (
                  <span
                    style={{
                      color: accuracy < 100 ? "#4ade80" : "#fb923c",
                      fontWeight: 600,
                    }}
                  >
                    ±{accuracy}m
                  </span>
                )}
              </div>
            )}
            {locError && (
              <div
                style={{
                  display: "inline-flex",
                  gap: 8,
                  background: "#7f1d1d20",
                  border: "1px solid #7f1d1d",
                  borderRadius: 24,
                  padding: "6px 14px",
                  marginBottom: 10,
                  fontSize: 12,
                  color: "#f87171",
                }}
              >
                ⚠️ {locError}
              </div>
            )}

            {/* Manual coords */}
            <div>
              <button
                onClick={() => setShowManual((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#f97316",
                  cursor: "pointer",
                  fontSize: 12,
                  padding: 0,
                  textDecoration: "underline",
                  fontFamily: "inherit",
                }}
              >
                📌 {showManual ? t("hide") : t("manual_entry_prompt")}
              </button>
              {showManual && (
                <div
                  style={{
                    marginTop: 12,
                    background: th.inputBg,
                    border: `1px solid ${th.border}`,
                    borderRadius: 14,
                    padding: 16,
                  }}
                >
                  <p
                    style={{
                      color: th.textFaint,
                      fontSize: 12,
                      marginBottom: 10,
                    }}
                  >
                    {t("manual_hint")}{" "}
                    <a
                      href="https://www.latlong.net"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#f97316" }}
                    >
                      latlong.net
                    </a>
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      style={{
                        ...cs.input,
                        background: th.card,
                        borderColor: th.border,
                        color: th.text,
                      }}
                      placeholder={t("lat_placeholder")}
                      value={manualLat}
                      onChange={(e) => setManualLat(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleManualSubmit()
                      }
                    />
                    <input
                      style={{
                        ...cs.input,
                        background: th.card,
                        borderColor: th.border,
                        color: th.text,
                      }}
                      placeholder={t("lng_placeholder")}
                      value={manualLng}
                      onChange={(e) => setManualLng(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleManualSubmit()
                      }
                    />
                    <button onClick={handleManualSubmit} style={cs.btnOrange}>
                      {t("search_here")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stats panel */}
          <div
            style={{
              display: "flex",
              background: th.card,
              border: `1px solid ${th.border}`,
              borderRadius: 20,
              overflow: "hidden",
              alignSelf: "flex-start",
              flexShrink: 0,
            }}
          >
            {[
              {
                num: displayed.length || pumps.length,
                sub: t("stations_found"),
              },
              {
                num:
                  pumps[0]?.distance != null
                    ? `${pumps[0].distance.toFixed(1)}km`
                    : "—",
                sub: t("nearest"),
              },
              {
                num: nhActive
                  ? nhInput.toUpperCase() || "NH"
                  : `${radius / 1000} km`,
                sub: nhActive ? t("highway") : t("radius"),
              },
              { num: favorites.length, sub: t("saved") },
            ].map(({ num, sub }, i, arr) => (
              <div key={sub} style={{ display: "flex", alignItems: "center" }}>
                <div style={{ padding: "22px 22px", textAlign: "center" }}>
                  <div
                    style={{
                      fontFamily: "'Barlow Condensed',sans-serif",
                      fontSize: 26,
                      fontWeight: 900,
                      color: "#f97316",
                      lineHeight: 1,
                    }}
                  >
                    {num}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: th.textFaint,
                      marginTop: 4,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    {sub}
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <div
                    style={{ width: 1, height: 44, background: th.border }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── MAP ──────────────────────────────────────────────────────── */}
        {showMap && (
          <div style={{ margin: "20px 48px 0" }}>
            <div
              style={{
                borderRadius: 18,
                overflow: "hidden",
                border: `1px solid ${th.border}`,
                height: 460,
              }}
            >
              <MapContainer
                center={
                  mapCentre
                    ? [mapCentre.lat, mapCentre.lng]
                    : [20.5937, 78.9629]
                }
                zoom={mapCentre ? mapZoom : 5}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url={
                    dark
                      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  }
                />
                {mapCentre && (
                  <RecenterMap
                    lat={mapCentre.lat}
                    lng={mapCentre.lng}
                    zoom={mapZoom}
                  />
                )}
                {mapCentre && (
                  <>
                    <Marker
                      position={[mapCentre.lat, mapCentre.lng]}
                      icon={pinIcon("#3b82f6", 28)}
                    >
                      <Popup>
                        <strong>
                          📍 {searchLoc ? "Search centre" : t("your_location")}
                        </strong>
                      </Popup>
                    </Marker>
                    {/* Radius ring — updates live */}
                    <Circle
                      center={[mapCentre.lat, mapCentre.lng]}
                      radius={radius}
                      pathOptions={{
                        color: "#f97316",
                        weight: 1.5,
                        fillColor: "#f97316",
                        fillOpacity: 0.04,
                      }}
                    />
                  </>
                )}
                {displayed.map((pump) => (
                  <Marker
                    key={pump.id}
                    position={[pump.lat, pump.lon]}
                    icon={pinIcon(brandColor(pump.tags?.name || ""), 26)}
                  >
                    <Popup>
                      <div
                        style={{
                          fontFamily: "'DM Sans',sans-serif",
                          minWidth: 160,
                        }}
                      >
                        <strong style={{ fontSize: 14 }}>
                          {pump.tags?.name || t("petrol_pump")}
                        </strong>
                        <br />
                        {pump.tags?.brand && (
                          <span style={{ color: "#6b7280", fontSize: 12 }}>
                            {pump.tags.brand}
                            <br />
                          </span>
                        )}
                        {pump.distance != null && (
                          <span style={{ fontSize: 12 }}>
                            📏 {pump.distance.toFixed(2)} km •{" "}
                            {estTime(pump.distance)}
                          </span>
                        )}
                        <br />
                        <button
                          onClick={() => {
                            setRouteDest(pump);
                            setRouteInfo(null);
                          }}
                          style={{
                            marginTop: 8,
                            background: "#f97316",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            padding: "5px 12px",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          🧭 {t("show_route")}
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
                {routeDest && mapCentre && (
                  <RouteLayer
                    userLoc={mapCentre}
                    dest={routeDest}
                    onRouteInfo={setRouteInfo}
                  />
                )}
              </MapContainer>
            </div>

            {/* Route info */}
            {routeDest && (
              <div
                style={{
                  background: th.card,
                  border: `1px solid ${th.border}`,
                  borderRadius: "0 0 18px 18px",
                  borderTop: "none",
                  padding: "10px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 13, color: th.textSub }}>
                  🧭 {t("routing_to")}:{" "}
                  <strong style={{ color: "#f97316" }}>
                    {routeDest.tags?.name || t("petrol_pump")}
                  </strong>
                </span>
                {routeInfo && (
                  <>
                    <span style={{ fontSize: 12, color: th.textFaint }}>
                      📏 {routeInfo.distance} km
                    </span>
                    <span style={{ fontSize: 12, color: th.textFaint }}>
                      ⏱ {routeInfo.duration} min
                    </span>
                  </>
                )}
                <button
                  onClick={() => {
                    setRouteDest(null);
                    setRouteInfo(null);
                  }}
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "none",
                    color: th.textFaint,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  ✕ {t("clear_route")}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── ERROR BAR ─────────────────────────────────────────────────── */}
        {fetchError && (
          <div
            style={{
              margin: "16px 48px 0",
              background: "#7f1d1d20",
              border: "1px solid #7f1d1d60",
              borderRadius: 12,
              padding: "12px 20px",
              color: "#fca5a5",
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 13,
            }}
          >
            ⚠️ {fetchError}
            <button
              onClick={() => {
                setFetchError("");
                fetchPumps();
              }}
              style={{
                ...cs.btnOrange,
                padding: "5px 14px",
                fontSize: 12,
                marginLeft: "auto",
              }}
            >
              {t("retry")}
            </button>
          </div>
        )}

        {/* ── FILTER + SORT + NAME SEARCH ───────────────────────────────── */}
        {(pumps.length > 0 || loading) && (
          <div
            style={{
              padding: "16px 48px 14px",
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              borderBottom: `1px solid ${th.border}`,
            }}
          >
            {/* Name filter */}
            <div style={{ position: "relative" }}>
              <input
                style={{
                  ...cs.input,
                  background: th.inputBg,
                  borderColor: th.border,
                  color: th.text,
                  width: 200,
                  paddingLeft: 30,
                  height: 36,
                }}
                placeholder="Filter by name…"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
              />
              <span
                style={{
                  position: "absolute",
                  left: 9,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 13,
                  pointerEvents: "none",
                }}
              >
                🔎
              </span>
              {nameFilter && (
                <button
                  onClick={() => setNameFilter("")}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: th.textFaint,
                    fontSize: 13,
                    padding: 0,
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            <div style={{ width: 1, height: 20, background: th.border }} />

            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: th.textFaint,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {t("fuel")}
            </span>
            {FUEL_DEFS.map(({ key, label, icon, color }) => {
              const active = fuelFilter.includes(key);
              return (
                <button
                  key={key}
                  className="fs-chip"
                  onClick={() =>
                    setFuelFilter((p) =>
                      p.includes(key)
                        ? p.filter((k) => k !== key)
                        : [...p, key],
                    )
                  }
                  style={{
                    ...cs.chip,
                    background: active ? `${color}22` : th.card,
                    color: active ? color : th.textSub,
                    borderColor: active ? color : th.border,
                  }}
                >
                  {icon} {label}
                </button>
              );
            })}

            <div style={{ width: 1, height: 20, background: th.border }} />

            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: th.textFaint,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {t("sort")}
            </span>
            {[
              ["distance", "📏 " + t("sort_distance")],
              ["rating", "⭐ " + t("sort_rating")],
              ["name", "🔤 " + t("sort_name")],
            ].map(([s, label]) => (
              <button
                key={s}
                className="fs-chip"
                onClick={() => setSortBy(s)}
                style={{
                  ...cs.chip,
                  background: sortBy === s ? "#f9731622" : th.card,
                  color: sortBy === s ? "#f97316" : th.textSub,
                  borderColor: sortBy === s ? "#f97316" : th.border,
                }}
              >
                {label}
              </button>
            ))}

            <button
              onClick={() => {
                const tgt = searchLoc || location;
                if (tgt) fetchPumps(tgt);
              }}
              style={{
                marginLeft: "auto",
                ...cs.btnGhost,
                borderColor: "#f97316",
                color: "#f97316",
              }}
            >
              🔄 {t("refresh")}
            </button>
          </div>
        )}

        {/* Active filter pills */}
        {(fuelFilter.length > 0 || showFavs || nameFilter) && (
          <div
            style={{
              padding: "10px 48px 0",
              fontSize: 12,
              color: th.textSub,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
            }}
          >
            {fuelFilter.length > 0 && (
              <span
                style={{
                  background: "#f9731618",
                  border: "1px solid #f9731640",
                  borderRadius: 20,
                  padding: "3px 12px",
                  color: "#f97316",
                }}
              >
                ⛽{" "}
                {fuelFilter
                  .map((k) => FUEL_DEFS.find((f) => f.key === k)?.label)
                  .join(" + ")}
              </span>
            )}
            {showFavs && (
              <span
                style={{
                  background: "#ef444418",
                  border: "1px solid #ef444440",
                  borderRadius: 20,
                  padding: "3px 12px",
                  color: "#ef4444",
                }}
              >
                ❤️ Favorites only
              </span>
            )}
            {nameFilter && (
              <span
                style={{
                  background: "#3b82f618",
                  border: "1px solid #3b82f640",
                  borderRadius: 20,
                  padding: "3px 12px",
                  color: "#3b82f6",
                }}
              >
                🔎 "{nameFilter}"
              </span>
            )}
            <span style={{ color: th.textFaint }}>
              {displayed.length} result{displayed.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => {
                setFuelFilter([]);
                setShowFavs(false);
                setNameFilter("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#f87171",
                cursor: "pointer",
                fontSize: 12,
                textDecoration: "underline",
                fontFamily: "inherit",
              }}
            >
              ✕ {t("clear_all")}
            </button>
          </div>
        )}

        {/* ── CARDS GRID ────────────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(310px,1fr))",
            gap: 20,
            padding: "22px 48px 0",
          }}
        >
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : displayed.map((pump, idx) => {
                const name =
                  pump.tags?.name ||
                  pump.tags?.brand ||
                  pump.tags?.operator ||
                  t("petrol_pump");
                const street =
                  pump.tags?.["addr:street"] ||
                  pump.tags?.["addr:city"] ||
                  pump.tags?.["addr:suburb"] ||
                  t("near_highway");
                const open24 = pump.tags?.opening_hours === "24/7";
                const isFav = favorites.includes(pump.id);
                const rating = avgRating(pump.id);
                const rvs = reviews[pump.id] || [];
                const color = brandColor(name);
                const avs = availStyle[pump.avail] || availStyle.available;
                const availLabel = {
                  available: t("available"),
                  limited: t("limited"),
                  unavailable: t("unavailable"),
                };

                return (
                  <div
                    key={pump.id}
                    className="fs-card"
                    style={{
                      ...cs.card,
                      background: th.card,
                      borderColor:
                        hoveredId === pump.id ? "#f97316" : th.border,
                      animation: `fadeUp 0.35s ease ${Math.min(idx * 0.05, 0.4)}s both`,
                    }}
                    onMouseEnter={() => setHoveredId(pump.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {/* Header */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: color,
                          flexShrink: 0,
                          marginTop: 5,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: th.text,
                            margin: 0,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {name}
                        </h3>
                        {rating > 0 && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              marginTop: 2,
                            }}
                          >
                            {"★★★★★".split("").map((_, i) => (
                              <span
                                key={i}
                                style={{
                                  color:
                                    i < Math.round(rating)
                                      ? "#f59e0b"
                                      : "#374151",
                                  fontSize: 11,
                                }}
                              >
                                ★
                              </span>
                            ))}
                            <span style={{ fontSize: 10, color: th.textFaint }}>
                              {rating.toFixed(1)} ({rvs.length})
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => toggleFav(pump.id)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 18,
                          padding: 0,
                          lineHeight: 1,
                          color: isFav ? "#ef4444" : th.textFaint,
                        }}
                      >
                        {isFav ? "❤️" : "🤍"}
                      </button>
                    </div>

                    <p
                      style={{
                        fontSize: 12,
                        color: th.textFaint,
                        marginBottom: 10,
                      }}
                    >
                      📍 {street}
                    </p>

                    {/* Availability */}
                    <div style={{ marginBottom: 10 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: avs.color,
                          background: avs.bg,
                          border: `1px solid ${avs.border}`,
                          borderRadius: 20,
                          padding: "2px 10px",
                        }}
                      >
                        ● {availLabel[pump.avail]}
                      </span>
                    </div>

                    {/* Fuel tags */}
                    <div
                      style={{
                        display: "flex",
                        gap: 5,
                        flexWrap: "wrap",
                        marginBottom: 12,
                      }}
                    >
                      {pump.fuels.length > 0 ? (
                        pump.fuels.map((k) => {
                          const fd = FUEL_DEFS.find((f) => f.key === k);
                          const hi = fuelFilter.includes(k);
                          return (
                            <span
                              key={k}
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: "3px 8px",
                                borderRadius: 20,
                                background: hi
                                  ? `${fd.color}44`
                                  : `${fd.color}18`,
                                color: hi ? "#fff" : fd.color,
                                border: `1px solid ${fd.color}40`,
                              }}
                            >
                              {fd.icon} {fd.label}
                            </span>
                          );
                        })
                      ) : (
                        <span
                          style={{
                            fontSize: 10,
                            color: th.textFaint,
                            background: th.inputBg,
                            border: `1px solid ${th.border}`,
                            borderRadius: 20,
                            padding: "3px 8px",
                          }}
                        >
                          {t("fuel_na")}
                        </span>
                      )}
                      {open24 && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: 20,
                            background: "#16a34a18",
                            color: "#4ade80",
                            border: "1px solid #16a34a40",
                          }}
                        >
                          24/7
                        </span>
                      )}
                    </div>

                    {/* Distance + ETA */}
                    {pump.distance != null && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 6,
                          marginBottom: 14,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'Barlow Condensed',sans-serif",
                            fontSize: 30,
                            fontWeight: 900,
                            color: "#f97316",
                            lineHeight: 1,
                          }}
                        >
                          {pump.distance.toFixed(2)}
                        </span>
                        <span style={{ fontSize: 12, color: th.textFaint }}>
                          km
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: "#f97316",
                            marginLeft: "auto",
                            background: "#f9731618",
                            borderRadius: 20,
                            padding: "2px 10px",
                            border: "1px solid #f9731640",
                          }}
                        >
                          ⏱ {estTime(pump.distance)}
                        </span>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="fs-btn-primary"
                        style={{ ...cs.btnOrange, flex: 2, padding: "10px 0" }}
                        onClick={() => {
                          setRouteDest(pump);
                          setRouteInfo(null);
                          setShowMap(true);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        🧭 {t("navigate")}
                      </button>
                      <button
                        style={{
                          ...cs.btnGhost,
                          flex: 1,
                          padding: "10px 0",
                          borderColor: th.border,
                          color: th.textSub,
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.borderColor = "#f97316")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.borderColor = th.border)
                        }
                        onClick={() => setReviewModal(pump)}
                      >
                        ⭐ {t("review")}
                      </button>
                    </div>
                    <button
                      style={{
                        ...cs.btnGhost,
                        width: "100%",
                        marginTop: 8,
                        padding: "8px 0",
                        borderColor: th.border,
                        color: th.textFaint,
                        fontSize: 12,
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "#f97316")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = th.textFaint)
                      }
                      onClick={() =>
                        window.open(
                          `https://www.google.com/maps/dir/?api=1&destination=${pump.lat},${pump.lon}`,
                          "_blank",
                        )
                      }
                    >
                      🗺️ {t("google_maps")}
                    </button>
                  </div>
                );
              })}
        </div>

        {/* Empty state */}
        {!loading &&
          pumps.length === 0 &&
          !fetchError &&
          !location &&
          !searchLoc && (
            <div
              style={{
                textAlign: "center",
                color: th.textFaint,
                padding: "80px 48px",
              }}
            >
              <div style={{ fontSize: 56, marginBottom: 16 }}>📡</div>
              <p style={{ fontSize: 16, marginBottom: 8 }}>
                {t("waiting_location")}
              </p>
              <p style={{ fontSize: 13 }}>
                Or type a city / town in the search bar above
              </p>
            </div>
          )}
      </div>

      {/* Review modal */}
      {reviewModal && (
        <ReviewModal
          pump={reviewModal}
          dark={dark}
          th={th}
          reviews={reviews[reviewModal.id] || []}
          onClose={() => setReviewModal(null)}
          onSubmit={(r) => submitReview(reviewModal, r)}
          t={t}
        />
      )}
    </>
  );
}

// ── Theme tokens ──────────────────────────────────────────────────────────────
const DARK = {
  bg: "#070d1a",
  card: "#0f1a2e",
  text: "#f1f5f9",
  textSub: "#94a3b8",
  textFaint: "#475569",
  border: "#1e293b",
  inputBg: "#0b1221",
};
const LIGHT = {
  bg: "#f8fafc",
  card: "#ffffff",
  text: "#0f172a",
  textSub: "#475569",
  textFaint: "#94a3b8",
  border: "#e2e8f0",
  inputBg: "#f1f5f9",
};

// ── Component styles ──────────────────────────────────────────────────────────
const cs = {
  card: { border: "1px solid", borderRadius: 18, padding: "20px 20px 16px" },
  skel: {
    background: "linear-gradient(90deg,#1e293b 25%,#293548 50%,#1e293b 75%)",
    backgroundSize: "200% 100%",
    borderRadius: 6,
    animation: "shimmer 1.6s infinite",
  },
  input: {
    border: "1px solid",
    borderRadius: 9,
    padding: "9px 13px",
    fontSize: 13,
    outline: "none",
    width: 170,
    fontFamily: "inherit",
    transition: "border-color 0.15s",
  },
  btnOrange: {
    background: "#f97316",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "9px 16px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transition: "filter 0.15s",
  },
  btnGhost: {
    background: "transparent",
    border: "1px solid",
    borderRadius: 10,
    padding: "9px 16px",
    cursor: "pointer",
    fontWeight: 500,
    fontSize: 13,
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transition: "color 0.15s, border-color 0.15s",
  },
  chip: {
    border: "1px solid",
    borderRadius: 20,
    padding: "5px 13px",
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "inherit",
    transition: "all 0.15s",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  },
  topBtn: {
    border: "1px solid",
    borderRadius: 9,
    padding: "6px 13px",
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "inherit",
    transition: "all 0.15s",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },
};
