/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║        FUEL SPOTTER — Backend API (server/index.js)         ║
 * ║        Node.js + Express + MongoDB                          ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Setup:
 *   cd server
 *   npm install express cors mongoose dotenv helmet morgan
 *   Create .env file (see bottom of this file)
 *   node index.js   OR   nodemon index.js
 *
 * API Routes:
 *   GET    /api/health                     Health check
 *   GET    /api/reviews/:pumpId            Get reviews for a pump
 *   POST   /api/reviews                    Submit a review
 *   DELETE /api/reviews/:id                Delete review (admin)
 *   GET    /api/favorites/:sessionId       Get user's saved pumps
 *   POST   /api/favorites/toggle           Add/remove favorite
 *   GET    /api/availability/:pumpId       Fuel availability (mock → replace)
 *   GET    /api/stats                      App statistics
 */

require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const mongoose = require("mongoose");
const helmet   = require("helmet");
const morgan   = require("morgan");

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin: process.env.CLIENT_URL || ["http://localhost:3000", "https://fuel-spotter.vercel.app"],
  methods: ["GET", "POST", "DELETE"],
}));
app.use(express.json({ limit: "10kb" }));
app.use(morgan("dev"));

// ── MongoDB ───────────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/fuelspotter", {
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err.message));

// ── Models ────────────────────────────────────────────────────────────────────

const reviewSchema = new mongoose.Schema({
  pumpId:   { type: String, required: true, index: true },
  pumpName: { type: String, default: "" },
  name:     { type: String, default: "Anonymous", maxlength: 60 },
  rating:   { type: Number, required: true, min: 1, max: 5 },
  text:     { type: String, required: true, minlength: 3, maxlength: 500 },
  flagged:  { type: Boolean, default: false },
}, { timestamps: true });
const Review = mongoose.model("Review", reviewSchema);

const favoriteSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  pumpId:    { type: String, required: true },
  pumpName:  { type: String, default: "" },
  lat:       Number,
  lon:       Number,
}, { timestamps: true });
favoriteSchema.index({ sessionId: 1, pumpId: 1 }, { unique: true });
const Favorite = mongoose.model("Favorite", favoriteSchema);

// ── Helpers ───────────────────────────────────────────────────────────────────
const validate = (obj, fields) => fields.find(f => !obj[f] && obj[f] !== 0);

// Rate-limit: simple in-memory (use express-rate-limit in production)
const rateMap = new Map();
function rateLimit(ip, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > windowMs) { entry.count = 0; entry.start = now; }
  entry.count++;
  rateMap.set(ip, entry);
  return entry.count > limit;
}

// ─────────────────────────────────────────────────────────────────────────────
//  HEALTH CHECK
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Fuel Spotter API",
    version: "2.0.0",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  REVIEWS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/reviews/:pumpId
app.get("/api/reviews/:pumpId", async (req, res) => {
  try {
    const reviews = await Review.find({ pumpId: req.params.pumpId, flagged: false })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const count = reviews.length;
    const avgRating = count
      ? parseFloat((reviews.reduce((s, r) => s + r.rating, 0) / count).toFixed(1))
      : 0;

    // Distribution (how many 1★, 2★… 5★)
    const distribution = [1, 2, 3, 4, 5].map(star => ({
      star,
      count: reviews.filter(r => r.rating === star).length,
    }));

    res.json({ reviews, avgRating, count, distribution });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reviews", details: err.message });
  }
});

// POST /api/reviews
app.post("/api/reviews", async (req, res) => {
  // Rate limit: 5 reviews per minute per IP
  if (rateLimit(req.ip, 5)) return res.status(429).json({ error: "Too many requests. Please wait." });

  const missing = validate(req.body, ["pumpId", "rating", "text"]);
  if (missing) return res.status(400).json({ error: `Missing field: ${missing}` });

  const { pumpId, pumpName, name, rating, text } = req.body;

  if (rating < 1 || rating > 5) return res.status(400).json({ error: "Rating must be 1–5" });
  if (text.trim().length < 3)   return res.status(400).json({ error: "Review too short" });
  if (text.length > 500)        return res.status(400).json({ error: "Review too long (max 500 chars)" });

  try {
    const review = await Review.create({
      pumpId, pumpName: pumpName || "",
      name: name?.trim() || "Anonymous",
      rating: Number(rating),
      text: text.trim(),
    });
    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ error: "Failed to save review" });
  }
});

// DELETE /api/reviews/:id  (admin)
app.delete("/api/reviews/:id", async (req, res) => {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  FAVORITES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/favorites/:sessionId
app.get("/api/favorites/:sessionId", async (req, res) => {
  try {
    const favs = await Favorite.find({ sessionId: req.params.sessionId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(favs);
  } catch {
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
});

// POST /api/favorites/toggle
app.post("/api/favorites/toggle", async (req, res) => {
  const missing = validate(req.body, ["sessionId", "pumpId"]);
  if (missing) return res.status(400).json({ error: `Missing field: ${missing}` });

  const { sessionId, pumpId, pumpName, lat, lon } = req.body;
  try {
    const existing = await Favorite.findOne({ sessionId, pumpId });
    if (existing) {
      await existing.deleteOne();
      res.json({ action: "removed", pumpId });
    } else {
      const fav = await Favorite.create({ sessionId, pumpId, pumpName: pumpName || "", lat, lon });
      res.status(201).json({ action: "added", fav });
    }
  } catch (err) {
    if (err.code === 11000) res.json({ action: "already_exists" });
    else res.status(500).json({ error: "Failed to toggle favorite" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  FUEL AVAILABILITY
//  Replace this mock with real data from IOC / HPCL / BPCL APIs when available
// ─────────────────────────────────────────────────────────────────────────────
const AVAIL_STATES = ["available", "available", "available", "limited", "unavailable"];

app.get("/api/availability/:pumpId", (req, res) => {
  const seed = String(req.params.pumpId)
    .split("")
    .reduce((s, c) => s + c.charCodeAt(0), 0);

  const fuel = (offset) => AVAIL_STATES[(seed + offset) % AVAIL_STATES.length];

  res.json({
    pumpId: req.params.pumpId,
    petrol: fuel(0),
    diesel: fuel(1),
    cng:    fuel(2),
    lpg:    fuel(3),
    ev:     fuel(4),
    note:   "Mock data — integrate real API for production",
    updatedAt: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  STATISTICS
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/stats", async (req, res) => {
  try {
    const [reviewCount, favoriteCount, topRated] = await Promise.all([
      Review.countDocuments({ flagged: false }),
      Favorite.countDocuments(),
      Review.aggregate([
        { $group: { _id: "$pumpId", avg: { $avg: "$rating" }, count: { $sum: 1 }, name: { $first: "$pumpName" } } },
        { $match: { count: { $gte: 2 } } },
        { $sort: { avg: -1 } },
        { $limit: 5 },
      ]),
    ]);
    res.json({ reviewCount, favoriteCount, topRated });
  } catch {
    res.status(500).json({ error: "Stats unavailable" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  404 & ERROR HANDLER
// ─────────────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n⛽  Fuel Spotter API v2.0`);
  console.log(`🚀  Running at http://localhost:${PORT}`);
  console.log(`📋  Endpoints:`);
  console.log(`    GET  /api/health`);
  console.log(`    GET  /api/reviews/:pumpId`);
  console.log(`    POST /api/reviews`);
  console.log(`    GET  /api/favorites/:sessionId`);
  console.log(`    POST /api/favorites/toggle`);
  console.log(`    GET  /api/availability/:pumpId`);
  console.log(`    GET  /api/stats\n`);
});

module.exports = app;

/*
 ─── .env file (create at server/.env) ────────────────────────────────────────
 PORT=5000
 CLIENT_URL=http://localhost:3000
 MONGODB_URI=mongodb://localhost:27017/fuelspotter
 ADMIN_KEY=your-secret-admin-key-here

 For production (MongoDB Atlas):
 MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/fuelspotter
*/