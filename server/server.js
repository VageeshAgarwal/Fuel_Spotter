const express  = require("express");
const mongoose = require("mongoose");
const cors     = require("cors");
require("dotenv").config();

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("Backend is live 🚀");
});
app.use("/api/auth", require("./routes/auth"));

// ── MongoDB ───────────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("Mongo Error:", err));

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => 
  console.log(`Server running on port ${PORT}`)
);