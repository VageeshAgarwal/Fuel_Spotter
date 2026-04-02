const express  = require("express");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const crypto   = require("crypto");
const User     = require("../models/User");
const sendOtp  = require("../utils/sendOtp");
const router   = express.Router();

// ── In-memory OTP store { email -> { otp, expiresAt } } ──────────────────────
// Fine for single-server. For multi-server/production, swap to Redis.
const otpStore = new Map();

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields required" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    await new User({ name, email, password: hashed }).save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ token });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email)
      return res.status(400).json({ message: "Email is required." });

    const user = await User.findOne({ email });

    // Always return 200 to prevent email enumeration attacks
    if (!user)
      return res.json({ message: "If this email exists, an OTP was sent." });

    // Generate 6-digit OTP and store with 10-min expiry
    const otp = crypto.randomInt(100000, 999999).toString();
    otpStore.set(email, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

    await sendOtp(email, otp);

    console.log(`OTP sent to ${email}`); // remove in production
    res.json({ message: "OTP sent to your email." });
  } catch (err) {
    console.error("FORGOT-PASSWORD ERROR:", err);
    res.status(500).json({ message: "Failed to send OTP. Try again." });
  }
});

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────
router.post("/verify-otp", (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp)
      return res.status(400).json({ message: "Email and OTP are required." });

    const record = otpStore.get(email);

    if (!record)
      return res.status(400).json({ message: "OTP not found. Request a new one." });

    if (Date.now() > record.expiresAt)  {
      otpStore.delete(email); // clean up expired
      return res.status(400).json({ message: "OTP expired. Request a new one." });
    }

    if (record.otp !== otp)
      return res.status(400).json({ message: "Invalid OTP." });

    // Mark as verified so reset-password knows OTP was checked
    otpStore.set(email, { ...record, verified: true });

    res.json({ message: "OTP verified." });
  } catch (err) {
    console.error("VERIFY-OTP ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password)
      return res.status(400).json({ message: "All fields are required." });

    if (password.length < 8)
      return res.status(400).json({ message: "Password must be at least 8 characters." });

    const record = otpStore.get(email);

    if (!record)
      return res.status(400).json({ message: "OTP not found. Request a new one." });

    if (Date.now() > record.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ message: "OTP expired. Request a new one." });
    }

    if (record.otp !== otp)
      return res.status(400).json({ message: "Invalid OTP." });

    if (!record.verified)
      return res.status(400).json({ message: "OTP not verified." });

    // Hash and save new password
    const hashed = await bcrypt.hash(password, 10);
    const updated = await User.findOneAndUpdate(
      { email },
      { password: hashed },
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ message: "User not found." });

    otpStore.delete(email); // invalidate OTP — can't be reused
    res.json({ message: "Password reset successfully." });
  } catch (err) {
    console.error("RESET-PASSWORD ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;