import { useEffect, useState, useCallback } from "react";
import Navbar from "../components/Navbar";

// ── Haversine (accurate to ~0.5 m) ───────────────────────────────────────────
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ── Overpass mirrors (ordered by reliability) ────────────────────────────────
// ── Overpass mirrors ─────────────────────────────────────────────────────────
const MIRRORS = [
  "https://overpass.openstreetmap.ru/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
async function fetchOverpass(query) {
  for (const url of MIRRORS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        body: query,
        signal: AbortSignal.timeout(25000),
      });
      if (res.ok) return await res.json();
    } catch {
      // mirror failed, try next one
    }
  }
  throw new Error("All mirrors failed");
}

// ── Fuel helpers ──────────────────────────────────────────────────────────────
const FUEL_DEFS = [
  {
    key: "petrol",
    label: "Petrol",
    tags: ["fuel:petrol", "fuel:octane_91", "fuel:octane_95", "fuel:unleaded"],
  },
  { key: "diesel", label: "Diesel", tags: ["fuel:diesel"] },
  { key: "cng", label: "CNG", tags: ["fuel:cng"] },
  { key: "lpg", label: "LPG", tags: ["fuel:lpg"] },
  {
    key: "ev",
    label: "EV",
    tags: ["fuel:electric", "amenity:charging_station"],
  },
];

function getFuels(tags = {}) {
  return FUEL_DEFS.filter(({ tags: t }) =>
    t.some((k) => tags[k] === "yes"),
  ).map((f) => f.key);
}

const BRAND_COLORS = {
  "indian oil": "#e63946",
  iocl: "#e63946",
  bpcl: "#2563eb",
  "bharat petroleum": "#2563eb",
  hpcl: "#16a34a",
  "hindustan petroleum": "#16a34a",
  shell: "#f59e0b",
  reliance: "#7c3aed",
};
function brandColor(name = "") {
  const low = name.toLowerCase();
  for (const [k, v] of Object.entries(BRAND_COLORS))
    if (low.includes(k)) return v;
  return "#f97316";
}

function SkeletonCard() {
  return (
    <div style={S.card}>
      {[
        [60, 18],
        [40, 13],
        [30, 13],
      ].map(([w, h], i) => (
        <div
          key={i}
          style={{ ...S.skel, width: `${w}%`, height: h, marginBottom: 10 }}
        />
      ))}
      <div style={{ ...S.skel, width: "100%", height: 38, borderRadius: 8 }} />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [location, setLocation] = useState(null);
  const [locError, setLocError] = useState("");
  const [accuracy, setAccuracy] = useState(null);
  const [pumps, setPumps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [sortBy, setSortBy] = useState("distance");
  const [fuelFilter, setFuelFilter] = useState([]); // ← NEW
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [hoveredId, setHoveredId] = useState(null); // ← avoids shorthand conflict

  // ── GPS ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocError("Geolocation not supported.");
      setShowManual(true);
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(Math.round(pos.coords.accuracy));
        setLocError("");
        if (pos.coords.accuracy < 100)
          navigator.geolocation.clearWatch(watchId);
      },
      (err) => {
        setLocError(
          {
            1: "Location permission denied.",
            2: "GPS unavailable.",
            3: "Location timed out.",
          }[err.code] || "Location error.",
        );
        setShowManual(true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // ── Fetch pumps ───────────────────────────────────────────────────────────
  const fetchPumps = useCallback(
    async (loc) => {
      const target = loc || location;
      if (!target) return;
      setLoading(true);
      setFetchError("");
      setPumps([]);

      const query = `
      [out:json][timeout:40];
      (
        node(around:5000,${target.lat},${target.lng})["amenity"="fuel"];
        way(around:5000,${target.lat},${target.lng})["amenity"="fuel"];
        relation(around:5000,${target.lat},${target.lng})["amenity"="fuel"];
      );
      out center tags;
    `;

      try {
        const data = await fetchOverpass(query);
        const enriched = (data.elements || [])
          .map((p) => {
            const lat = p.lat ?? p.center?.lat;
            const lon = p.lon ?? p.center?.lon;
            if (!lat || !lon) return null;
            return {
              ...p,
              lat,
              lon,
              distance: getDistanceKm(target.lat, target.lng, lat, lon),
              fuels: getFuels(p.tags),
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.distance - b.distance);

        setPumps(enriched);
        if (!enriched.length)
          setFetchError(
            "No pumps found within 5 km. Try entering coordinates manually.",
          );
      } catch {
        setFetchError(
          "All servers unreachable. Check your internet and retry.",
        );
      } finally {
        setLoading(false);
      }
    },
    [location],
  );

  useEffect(() => {
    if (location) fetchPumps(location);
  }, [location]); // eslint-disable-line

  // ── Manual coords ─────────────────────────────────────────────────────────
  function handleManualSubmit() {
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
    setAccuracy(null);
    fetchPumps(loc);
  }

  // ── Fuel filter toggle ────────────────────────────────────────────────────
  function toggleFuel(key) {
    setFuelFilter((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  // ── Filtered + sorted list ────────────────────────────────────────────────
  const displayed = [...pumps]
    .filter(
      (p) =>
        fuelFilter.length === 0 || fuelFilter.every((k) => p.fuels.includes(k)),
    )
    .sort((a, b) =>
      sortBy === "name"
        ? (a.tags?.name || "").localeCompare(b.tags?.name || "")
        : a.distance - b.distance,
    );

  return (
    <>
      <Navbar />
      <div style={S.page}>
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div style={S.hero}>
          <div style={S.heroLeft}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⛽</div>
            <h1 style={S.heroTitle}>FUEL SPOTTER</h1>
            <p style={S.heroSub}>Find Petrol Pumps Instantly</p>
            <div style={S.divider} />
            <p style={S.heroDesc}>
              Locate nearby fuel stations, check availability,
              <br />
              and navigate easily on highways.
            </p>

            {location && (
              <div style={S.locBadge}>
                📍 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                {accuracy !== null && (
                  <span
                    style={{
                      marginLeft: 8,
                      color: accuracy < 100 ? "#4ade80" : "#fb923c",
                    }}
                  >
                    ±{accuracy}m {accuracy < 100 ? "✓" : "(refining…)"}
                  </span>
                )}
              </div>
            )}
            {locError && <div style={S.errBadge}>⚠️ {locError}</div>}

            <button
              onClick={() => setShowManual((v) => !v)}
              style={S.manualToggle}
            >
              {showManual
                ? "▲ Hide"
                : "📌 Wrong location? Enter coordinates manually"}
            </button>

            {showManual && (
              <div style={S.manualBox}>
                <p
                  style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 10px" }}
                >
                  Find your exact coordinates at{" "}
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
                    style={S.input}
                    placeholder="Latitude (e.g. 26.2389)"
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                  />
                  <input
                    style={S.input}
                    placeholder="Longitude (e.g. 73.0243)"
                    value={manualLng}
                    onChange={(e) => setManualLng(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                  />
                  <button onClick={handleManualSubmit} style={S.manualBtn}>
                    Search Here
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div style={S.stats}>
            {[
              { num: pumps.length, label: "Stations Found" },
              {
                num: pumps.length ? `${pumps[0].distance.toFixed(2)} km` : "—",
                label: "Nearest",
              },
              { num: "5 km", label: "Radius" },
            ].map(({ num, label }, i, arr) => (
              <div
                key={label}
                style={{ display: "flex", alignItems: "center" }}
              >
                <div style={S.statBox}>
                  <span style={S.statNum}>{num}</span>
                  <span style={S.statLabel}>{label}</span>
                </div>
                {i < arr.length - 1 && <div style={S.statDivider} />}
              </div>
            ))}
          </div>
        </div>

        {/* ── Fetch error ───────────────────────────────────────────────────── */}
        {fetchError && (
          <div style={S.errorBar}>
            ⚠️ {fetchError}
            <button onClick={() => fetchPumps()} style={S.retryBtn}>
              Retry
            </button>
          </div>
        )}

        {/* ── Controls ─────────────────────────────────────────────────────── */}
        {(pumps.length > 0 || loading) && (
          <div style={S.controls}>
            {/* Fuel filter */}
            <span style={S.filterLabel}>Fuel:</span>
            {FUEL_DEFS.map(({ key, label }) => {
              const active = fuelFilter.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleFuel(key)}
                  style={{ ...S.chip, ...(active ? S.chipOn : {}) }}
                >
                  {label}
                </button>
              );
            })}

            <div style={S.sep} />

            {/* Sort */}
            <span style={S.filterLabel}>Sort:</span>
            {["distance", "name"].map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                style={{ ...S.chip, ...(sortBy === s ? S.chipOn : {}) }}
              >
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}

            <button onClick={() => fetchPumps()} style={S.refreshBtn}>
              🔄 Refresh
            </button>
          </div>
        )}

        {/* Filter summary */}
        {fuelFilter.length > 0 && (
          <div style={S.filterSummary}>
            Showing pumps with:{" "}
            <strong style={{ color: "#f97316" }}>
              {fuelFilter
                .map((k) => FUEL_DEFS.find((f) => f.key === k)?.label)
                .join(" + ")}
            </strong>
            <span style={{ color: "#6b7280" }}>
              {" "}
              — {displayed.length} result{displayed.length !== 1 ? "s" : ""}
            </span>
            <button onClick={() => setFuelFilter([])} style={S.clearBtn}>
              ✕ Clear filter
            </button>
          </div>
        )}

        {/* ── Cards ────────────────────────────────────────────────────────── */}
        <div style={S.grid}>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : displayed.map((pump) => {
                const name =
                  pump.tags?.name ||
                  pump.tags?.brand ||
                  pump.tags?.operator ||
                  "Petrol Pump";
                const street =
                  pump.tags?.["addr:street"] ||
                  pump.tags?.["addr:city"] ||
                  pump.tags?.["addr:suburb"] ||
                  "Near Highway";
                const open24 = pump.tags?.opening_hours === "24/7";
                const isHover = hoveredId === pump.id;

                return (
                  <div
                    key={pump.id}
                    style={{
                      ...S.card,
                      borderColor: isHover ? "#f97316" : "#1f2937",
                    }}
                    onMouseEnter={() => setHoveredId(pump.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ ...S.dot, background: brandColor(name) }} />
                      <h3 style={S.cardTitle}>{name}</h3>
                    </div>

                    <p style={S.cardStreet}>📍 {street}</p>

                    <div style={S.tagRow}>
                      {pump.fuels.length > 0 ? (
                        pump.fuels.map((k) => (
                          <span
                            key={k}
                            style={{
                              ...S.tag,
                              ...(fuelFilter.includes(k) ? S.tagHighlight : {}),
                            }}
                          >
                            {FUEL_DEFS.find((f) => f.key === k)?.label}
                          </span>
                        ))
                      ) : (
                        <span
                          style={{
                            ...S.tag,
                            color: "#6b7280",
                            borderColor: "#374151",
                          }}
                        >
                          Fuel info N/A
                        </span>
                      )}
                      {open24 && (
                        <span
                          style={{
                            ...S.tag,
                            background: "#16a34a22",
                            color: "#4ade80",
                            borderColor: "#16a34a44",
                          }}
                        >
                          24/7
                        </span>
                      )}
                    </div>

                    <div style={S.distRow}>
                      <span style={S.distNum}>{pump.distance.toFixed(2)}</span>
                      <span style={S.distUnit}> km away</span>
                    </div>

                    <button
                      style={S.dirBtn}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "#ea6a00")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "#f97316")
                      }
                      onClick={() =>
                        window.open(
                          `https://www.google.com/maps/dir/?api=1&destination=${pump.lat},${pump.lon}`,
                          "_blank",
                        )
                      }
                    >
                      🗺 Get Directions
                    </button>
                  </div>
                );
              })}
        </div>

        {!loading && pumps.length === 0 && !fetchError && !location && (
          <div style={S.empty}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📡</div>
            <p>Waiting for your location…</p>
          </div>
        )}
      </div>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh",
    background: "#0a0f1c",
    color: "#fff",
    fontFamily: "'Segoe UI',sans-serif",
    paddingBottom: 60,
  },
  hero: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 32,
    padding: "60px 48px 48px",
    borderBottom: "1px solid #1f2937",
  },
  heroLeft: { flex: 1, minWidth: 280 },
  heroTitle: {
    fontSize: "clamp(2.5rem,6vw,4.5rem)",
    fontWeight: 900,
    color: "#f97316",
    letterSpacing: "-1px",
    margin: "0 0 6px",
    lineHeight: 1,
  },
  heroSub: {
    fontSize: 18,
    fontWeight: 600,
    color: "#e2e8f0",
    margin: "0 0 12px",
  },
  divider: {
    width: 60,
    height: 3,
    background: "#f97316",
    borderRadius: 2,
    marginBottom: 16,
  },
  heroDesc: {
    color: "#9ca3af",
    fontSize: 15,
    lineHeight: 1.7,
    margin: "0 0 16px",
  },
  locBadge: {
    display: "inline-block",
    background: "#1f2937",
    color: "#9ca3af",
    fontSize: 13,
    padding: "5px 14px",
    borderRadius: 20,
    border: "1px solid #374151",
    marginBottom: 10,
  },
  errBadge: {
    display: "inline-block",
    background: "#7f1d1d22",
    color: "#f87171",
    fontSize: 13,
    padding: "5px 14px",
    borderRadius: 20,
    border: "1px solid #7f1d1d",
    marginBottom: 10,
  },
  manualToggle: {
    display: "block",
    marginTop: 10,
    background: "none",
    border: "none",
    color: "#f97316",
    cursor: "pointer",
    fontSize: 13,
    padding: 0,
    textDecoration: "underline",
  },
  manualBox: {
    marginTop: 14,
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 12,
    padding: 16,
  },
  input: {
    background: "#1f2937",
    border: "1px solid #374151",
    borderRadius: 8,
    color: "#fff",
    padding: "8px 12px",
    fontSize: 13,
    outline: "none",
    width: 170,
  },
  manualBtn: {
    background: "#f97316",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
  },
  stats: {
    display: "flex",
    alignItems: "center",
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 16,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  statBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "24px 28px",
  },
  statNum: { fontSize: 26, fontWeight: 800, color: "#f97316" },
  statLabel: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statDivider: { width: 1, height: 48, background: "#1f2937", flexShrink: 0 },
  errorBar: {
    margin: "16px 48px 0",
    padding: "12px 20px",
    background: "#7f1d1d22",
    border: "1px solid #7f1d1d",
    borderRadius: 10,
    color: "#fca5a5",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  retryBtn: {
    background: "#f97316",
    color: "#fff",
    border: "none",
    padding: "6px 16px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
  },
  controls: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "24px 48px 0",
    flexWrap: "wrap",
  },
  filterLabel: { color: "#6b7280", fontSize: 13, fontWeight: 600 },
  sep: { width: 1, height: 20, background: "#1f2937", margin: "0 4px" },
  chip: {
    background: "#1f2937",
    color: "#9ca3af",
    border: "1px solid #374151",
    padding: "5px 14px",
    borderRadius: 20,
    cursor: "pointer",
    fontSize: 13,
  },
  chipOn: { background: "#f9731622", color: "#f97316", borderColor: "#f97316" },
  refreshBtn: {
    marginLeft: "auto",
    background: "transparent",
    color: "#f97316",
    border: "1px solid #f97316",
    padding: "6px 18px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  filterSummary: { padding: "12px 48px 0", fontSize: 13, color: "#e2e8f0" },
  clearBtn: {
    marginLeft: 10,
    background: "none",
    border: "none",
    color: "#f87171",
    cursor: "pointer",
    fontSize: 13,
    textDecoration: "underline",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
    gap: 20,
    padding: "28px 48px 0",
  },
  card: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 16,
    padding: "22px 22px 18px",
    transition: "border-color 0.2s",
  },
  dot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: "#f1f5f9", margin: 0 },
  cardStreet: { fontSize: 13, color: "#6b7280", margin: "0 0 12px" },
  tagRow: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 },
  tag: {
    background: "#f9731611",
    color: "#fb923c",
    fontSize: 11,
    padding: "3px 10px",
    borderRadius: 20,
    fontWeight: 600,
    border: "1px solid #f9731633",
  },
  tagHighlight: {
    background: "#f9731644",
    color: "#fff",
    borderColor: "#f97316",
  },
  distRow: { display: "flex", alignItems: "baseline", marginBottom: 16 },
  distNum: { fontSize: 28, fontWeight: 800, color: "#f97316" },
  distUnit: { fontSize: 13, color: "#6b7280" },
  dirBtn: {
    width: "100%",
    background: "#f97316",
    color: "#fff",
    border: "none",
    padding: "10px 0",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
    transition: "background 0.15s",
  },
  skel: {
    background: "linear-gradient(90deg,#1f2937 25%,#374151 50%,#1f2937 75%)",
    backgroundSize: "200% 100%",
    borderRadius: 6,
  },
  empty: {
    textAlign: "center",
    color: "#6b7280",
    padding: "80px 0",
    fontSize: 16,
  },
};
