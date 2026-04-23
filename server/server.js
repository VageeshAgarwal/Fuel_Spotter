// ============================================================
//  Fuel Spotter Backend (Merged Version)
// ============================================================

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// ── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json());

// ── Basic Route ──────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("Backend is live 🚀");
});

// ── Auth Route (from your original code) ─────────────────────
app.use("/api/auth", require("./routes/auth"));

// ── MongoDB Connection (merged logic) ────────────────────────
mongoose
  .connect(process.env.MONGO_URL || process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ Mongo Error:", err));

// ── MODELS ──────────────────────────────────────────────────

// Reviews
const ReviewSchema = new mongoose.Schema({
  pumpId: String,
  pumpName: String,
  name: { type: String, default: "Anonymous" },
  rating: { type: Number, min: 1, max: 5 },
  text: String,
  createdAt: { type: Date, default: Date.now },
});
const Review = mongoose.model("Review", ReviewSchema);

// Favorites
const FavoriteSchema = new mongoose.Schema({
  sessionId: String,
  pumpId: String,
  pumpName: String,
  addedAt: { type: Date, default: Date.now },
});
FavoriteSchema.index({ sessionId: 1, pumpId: 1 }, { unique: true });
const Favorite = mongoose.model("Favorite", FavoriteSchema);

// ── REVIEWS ROUTES ──────────────────────────────────────────

// Get reviews
app.get("/api/reviews/:pumpId", async (req, res) => {
  const reviews = await Review.find({ pumpId: req.params.pumpId });
  const avg =
    reviews.length > 0
      ? reviews.reduce((a, b) => a + b.rating, 0) / reviews.length
      : 0;

  res.json({ reviews, avgRating: avg });
});

// Add review
app.post("/api/reviews", async (req, res) => {
  const { pumpId, rating, text } = req.body;

  if (!pumpId || !rating || !text)
    return res.status(400).json({ error: "Missing fields" });

  const review = await Review.create(req.body);
  res.status(201).json(review);
});

// ── FAVORITES ROUTES ────────────────────────────────────────

// Toggle favorite
app.post("/api/favorites/toggle", async (req, res) => {
  const { sessionId, pumpId } = req.body;

  const existing = await Favorite.findOne({ sessionId, pumpId });

  if (existing) {
    await existing.deleteOne();
    return res.json({ removed: true });
  }

  const fav = await Favorite.create(req.body);
  res.json(fav);
});

// Get favorites
app.get("/api/favorites/:sessionId", async (req, res) => {
  const favs = await Favorite.find({ sessionId: req.params.sessionId });
  res.json(favs);
});

// ── MOCK FUEL AVAILABILITY ──────────────────────────────────
app.get("/api/availability/:pumpId", (req, res) => {
  res.json({
    petrol: "available",
    diesel: "limited",
    cng: "available",
  });
});

// ── HEALTH CHECK ────────────────────────────────────────────
app.get("/api/health", (req, res) =>
  res.json({ status: "ok", time: new Date() })
);

// ── 404 HANDLER ─────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// ── START SERVER ────────────────────────────────────────────
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;