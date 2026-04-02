import { useState } from "react";
import api from "../utils/api";

// ── Step constants ────────────────────────────────────────────────────────────
const STEP_AUTH = "auth"; // Login / Sign Up
const STEP_FORGOT = "forgot"; // Enter email for OTP
const STEP_OTP = "otp"; // Enter 6-digit OTP
const STEP_RESET = "reset"; // Enter new password

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState(STEP_AUTH);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({ name: "", email: "", password: "" });

  // Forgot-password specific state
  const [fpEmail, setFpEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [toast, setToast] = useState(null); // { msg, type }

  // ── Toast helper ─────────────────────────────────────────────────────────
  function showToast(msg, type = "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── OTP input handling ────────────────────────────────────────────────────
  function handleOtpChange(val, idx) {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) document.getElementById(`otp-${idx + 1}`)?.focus();
  }

  function handleOtpKeyDown(e, idx) {
    if (e.key === "Backspace" && !otp[idx] && idx > 0)
      document.getElementById(`otp-${idx - 1}`)?.focus();
  }

  function handleOtpPaste(e) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(""));
      document.getElementById("otp-5")?.focus();
    }
    e.preventDefault();
  }

  // ── Countdown timer for resend ────────────────────────────────────────────
  function startTimer() {
    setOtpTimer(60);
    const iv = setInterval(() => {
      setOtpTimer((t) => {
        if (t <= 1) {
          clearInterval(iv);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  // ── API calls ─────────────────────────────────────────────────────────────
  async function handleAuthSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const res = await api.post("/auth/login", {
          email: form.email,
          password: form.password,
        });
        localStorage.setItem("token", res.data.token);
        window.location.href = "/";
      } else {
        await api.post("/auth/register", form);
        showToast("Account created! Please login.", "success");
        setIsLogin(true);
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp(e) {
    e?.preventDefault();
    if (!fpEmail) return showToast("Enter your email address.");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: fpEmail });
      showToast("OTP sent to your email.", "success");
      setStep(STEP_OTP);
      startTimer();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not send OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) return showToast("Enter the complete 6-digit OTP.");
    setLoading(true);
    try {
      await api.post("/auth/verify-otp", { email: fpEmail, otp: code });
      setStep(STEP_RESET);
    } catch (err) {
      showToast(err.response?.data?.message || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (newPassword.length < 8)
      return showToast("Password must be at least 8 characters.");
    if (newPassword !== confirmPass)
      return showToast("Passwords do not match.");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        email: fpEmail,
        otp: otp.join(""),
        password: newPassword,
      });
      showToast("Password reset! Please login.", "success");
      setStep(STEP_AUTH);
      setIsLogin(true);
      setOtp(["", "", "", "", "", ""]);
      setFpEmail("");
      setNewPassword("");
      setConfirmPass("");
    } catch (err) {
      showToast(err.response?.data?.message || "Reset failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Reusable input style ──────────────────────────────────────────────────
  const inputCls = `w-full p-3 rounded-lg bg-white/10 text-white placeholder-gray-400
    focus:ring-2 focus:ring-orange-500 outline-none`;

  // ── Step titles ───────────────────────────────────────────────────────────
  const stepMeta = {
    [STEP_AUTH]: { title: isLogin ? "Login" : "Sign Up" },
    [STEP_FORGOT]: { title: "Forgot Password" },
    [STEP_OTP]: { title: "Verify OTP" },
    [STEP_RESET]: { title: "Reset Password" },
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0b1d2a] to-[#0f2a3d] px-6">
      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg transition-all
          ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}
        >
          {toast.msg}
        </div>
      )}

      <div className="w-full max-w-5xl flex flex-col md:flex-row items-center gap-10">
        {/* ── Left hero ──────────────────────────────────────────────────── */}
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-5xl md:text-6xl font-extrabold text-orange-500">
            FUEL SPOTTER
          </h1>
          <p className="text-gray-300 text-xl mt-4">
            Find Petrol Pumps Instantly
          </p>
          <div className="w-32 h-[3px] bg-orange-500 mt-4 mx-auto md:mx-0" />
          <p className="text-gray-400 mt-6 max-w-md">
            Locate nearby fuel stations, check availability, and navigate easily
            on highways.
          </p>
        </div>

        {/* ── Right card ─────────────────────────────────────────────────── */}
        <div className="flex-1 max-w-md w-full">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-lg">
            {/* Back button for sub-steps */}
            {step !== STEP_AUTH && (
              <button
                onClick={() => {
                  if (step === STEP_OTP || step === STEP_FORGOT)
                    setStep(STEP_FORGOT === step ? STEP_AUTH : STEP_FORGOT);
                  if (step === STEP_RESET) setStep(STEP_OTP);
                }}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-orange-400 mb-5 transition"
              >
                ← Back
              </button>
            )}

            <h2 className="text-2xl text-white text-center mb-6 font-semibold">
              {stepMeta[step].title}
            </h2>

            {/* ── STEP: Login / Register ──────────────────────────────────── */}
            {step === STEP_AUTH && (
              <>
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  {!isLogin && (
                    <input
                      className={inputCls}
                      placeholder="Full Name"
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />
                  )}
                  <input
                    className={inputCls}
                    placeholder="Email"
                    type="email"
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                  <input
                    className={inputCls}
                    placeholder="Password"
                    type="password"
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                  />

                  {isLogin && (
                    <div className="text-right -mt-1">
                      <button
                        type="button"
                        onClick={() => setStep(STEP_FORGOT)}
                        className="text-xs text-orange-400 hover:text-orange-300 transition"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white py-3 rounded-lg font-semibold transition"
                  >
                    {loading
                      ? "Please wait…"
                      : isLogin
                        ? "Login"
                        : "Create Account"}
                  </button>
                </form>

                <p
                  className="text-center text-sm text-gray-400 mt-6 cursor-pointer hover:text-orange-400"
                  onClick={() => setIsLogin(!isLogin)}
                >
                  {isLogin
                    ? "New user? Sign up"
                    : "Already have an account? Login"}
                </p>
              </>
            )}

            {/* ── STEP: Enter email ───────────────────────────────────────── */}
            {step === STEP_FORGOT && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <p className="text-gray-400 text-sm text-center -mt-2 mb-2">
                  Enter your registered email and we'll send a 6-digit OTP.
                </p>
                <input
                  className={inputCls}
                  placeholder="Email address"
                  type="email"
                  value={fpEmail}
                  onChange={(e) => setFpEmail(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white py-3 rounded-lg font-semibold transition"
                >
                  {loading ? "Sending…" : "Send OTP"}
                </button>
              </form>
            )}

            {/* ── STEP: Enter OTP ─────────────────────────────────────────── */}
            {step === STEP_OTP && (
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <p className="text-gray-400 text-sm text-center -mt-2">
                  OTP sent to <span className="text-orange-400">{fpEmail}</span>
                </p>

                {/* 6 OTP boxes */}
                <div
                  className="flex justify-center gap-2"
                  onPaste={handleOtpPaste}
                >
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`otp-${idx}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(e.target.value, idx)}
                      onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                      className="w-11 h-13 text-center text-xl font-bold rounded-lg bg-white/10 text-white
                        border border-white/20 focus:border-orange-500 focus:ring-2 focus:ring-orange-500
                        outline-none transition caret-orange-400"
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white py-3 rounded-lg font-semibold transition"
                >
                  {loading ? "Verifying…" : "Verify OTP"}
                </button>

                {/* Resend */}
                <p className="text-center text-sm text-gray-400">
                  {otpTimer > 0 ? (
                    <>
                      Resend OTP in{" "}
                      <span className="text-orange-400 font-medium">
                        {otpTimer}s
                      </span>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="text-orange-400 hover:text-orange-300 transition underline"
                    >
                      Resend OTP
                    </button>
                  )}
                </p>
              </form>
            )}

            {/* ── STEP: New password ──────────────────────────────────────── */}
            {step === STEP_RESET && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-gray-400 text-sm text-center -mt-2 mb-2">
                  Choose a strong new password.
                </p>

                {/* New password with show/hide */}
                <div className="relative">
                  <input
                    className={inputCls}
                    placeholder="New password (min 8 chars)"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
                  >
                    {showNew ? "Hide" : "Show"}
                  </button>
                </div>

                {/* Strength bar */}
                {newPassword && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((lvl) => {
                        const strength =
                          (newPassword.length >= 8 ? 1 : 0) +
                          (/[A-Z]/.test(newPassword) ? 1 : 0) +
                          (/[0-9]/.test(newPassword) ? 1 : 0) +
                          (/[^A-Za-z0-9]/.test(newPassword) ? 1 : 0);
                        const colors = [
                          "bg-red-500",
                          "bg-orange-400",
                          "bg-yellow-400",
                          "bg-green-500",
                        ];
                        return (
                          <div
                            key={lvl}
                            className={`h-1 flex-1 rounded-full transition-all ${lvl <= strength ? colors[strength - 1] : "bg-white/10"}`}
                          />
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500">
                      {(() => {
                        const s =
                          (newPassword.length >= 8 ? 1 : 0) +
                          (/[A-Z]/.test(newPassword) ? 1 : 0) +
                          (/[0-9]/.test(newPassword) ? 1 : 0) +
                          (/[^A-Za-z0-9]/.test(newPassword) ? 1 : 0);
                        return ["", "Weak", "Fair", "Good", "Strong"][s];
                      })()}
                    </p>
                  </div>
                )}

                {/* Confirm password */}
                <div className="relative">
                  <input
                    className={inputCls}
                    placeholder="Confirm new password"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
                  >
                    {showConfirm ? "Hide" : "Show"}
                  </button>
                </div>

                {/* Match indicator */}
                {confirmPass && (
                  <p
                    className={`text-xs ${newPassword === confirmPass ? "text-green-400" : "text-red-400"}`}
                  >
                    {newPassword === confirmPass
                      ? "✓ Passwords match"
                      : "✗ Passwords don't match"}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white py-3 rounded-lg font-semibold transition"
                >
                  {loading ? "Resetting…" : "Reset Password"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
