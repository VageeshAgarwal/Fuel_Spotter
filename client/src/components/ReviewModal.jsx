/**
 * ReviewModal.jsx
 * Shows pump details, existing reviews, star rating, and write-review form.
 * Self-contained — receives reviews as prop, calls onSubmit on form submit.
 */

import { useState } from "react";

function StarRating({ value, onChange, readOnly = false, size = 20 }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <span
          key={star}
          onClick={() => !readOnly && onChange?.(star)}
          onMouseEnter={() => !readOnly && setHovered(star)}
          onMouseLeave={() => !readOnly && setHovered(0)}
          style={{
            fontSize: size,
            cursor: readOnly ? "default" : "pointer",
            color: star <= (hovered || value) ? "#f59e0b" : "#374151",
            transition: "color 0.1s",
            userSelect: "none",
          }}
        >★</span>
      ))}
    </div>
  );
}

export { StarRating };

export default function ReviewModal({ pump, dark, th, reviews, onClose, onSubmit, t }) {
  const [rating,  setRating]  = useState(0);
  const [text,    setText]    = useState("");
  const [name,    setName]    = useState("");
  const [success, setSuccess] = useState(false);

  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const handleSubmit = () => {
    if (!rating || !text.trim()) return;
    onSubmit({ rating, text: text.trim(), name: name.trim() || t("anonymous"), createdAt: new Date().toISOString() });
    setText(""); setRating(0); setName("");
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2500);
  };

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div style={{
        background: th.card,
        border: `1px solid ${th.border}`,
        borderRadius: 20,
        padding: 28,
        maxWidth: 520,
        width: "100%",
        maxHeight: "88vh",
        overflowY: "auto",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        color: th.text,
        fontFamily: "'DM Sans',sans-serif",
      }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: th.text }}>{pump.tags?.name || t("petrol_pump")}</h3>
            {pump.tags?.["addr:city"] && <p style={{ fontSize: 12, color: th.textFaint, margin: "3px 0 0" }}>📍 {pump.tags["addr:city"]}</p>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: th.textFaint, fontSize: 22, lineHeight: 1, padding: 0 }}>✕</button>
        </div>

        {/* Aggregate rating */}
        {avg && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, background: th.inputBg, borderRadius: 14, padding: "14px 18px", marginBottom: 20 }}>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 44, fontWeight: 900, color: "#f59e0b", lineHeight: 1 }}>{avg}</div>
            <div>
              <StarRating value={Math.round(avg)} readOnly size={18} />
              <div style={{ fontSize: 12, color: th.textFaint, marginTop: 4 }}>{reviews.length} {t("reviews")}</div>
            </div>
          </div>
        )}

        {/* Review list */}
        <div style={{ maxHeight: 220, overflowY: "auto", marginBottom: 24 }}>
          {reviews.length === 0
            ? <p style={{ color: th.textFaint, fontSize: 13, textAlign: "center", padding: "20px 0" }}>{t("no_reviews_yet")}</p>
            : reviews.slice(0, 10).map((r, i) => (
                <div key={i} style={{ borderBottom: `1px solid ${th.border}`, paddingBottom: 12, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: th.text }}>{r.name}</span>
                    <StarRating value={r.rating} readOnly size={12} />
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: th.textSub, lineHeight: 1.5 }}>{r.text}</p>
                  {r.createdAt && <span style={{ fontSize: 10, color: th.textFaint }}>{new Date(r.createdAt).toLocaleDateString()}</span>}
                </div>
              ))
          }
        </div>

        {/* Write review */}
        <div style={{ borderTop: `1px solid ${th.border}`, paddingTop: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: th.text, margin: "0 0 14px" }}>{t("write_review")}</h4>

          {success && (
            <div style={{ background: "#16a34a18", border: "1px solid #16a34a40", borderRadius: 10, padding: "10px 14px", color: "#4ade80", fontSize: 13, marginBottom: 12 }}>
              ✓ {t("review_submitted")}
            </div>
          )}

          <input
            style={{ width: "100%", background: th.inputBg, border: `1px solid ${th.border}`, borderRadius: 9, color: th.text, padding: "9px 13px", fontSize: 13, outline: "none", fontFamily: "inherit", marginBottom: 10 }}
            placeholder={t("your_name")}
            value={name}
            onChange={e => setName(e.target.value)}
          />

          <div style={{ marginBottom: 12 }}>
            <StarRating value={rating} onChange={setRating} size={26} />
            {rating === 0 && <span style={{ fontSize: 11, color: th.textFaint, marginTop: 4, display: "block" }}>{t("tap_to_rate")}</span>}
          </div>

          <textarea
            style={{ width: "100%", background: th.inputBg, border: `1px solid ${th.border}`, borderRadius: 9, color: th.text, padding: "10px 13px", fontSize: 13, outline: "none", fontFamily: "inherit", minHeight: 90, resize: "vertical", marginBottom: 12 }}
            placeholder={t("review_placeholder")}
            value={text}
            onChange={e => setText(e.target.value)}
            maxLength={500}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: th.textFaint }}>{text.length}/500</span>
            <button
              onClick={handleSubmit}
              disabled={!rating || !text.trim()}
              style={{
                background: rating && text.trim() ? "#f97316" : "#374151",
                color: "#fff", border: "none", borderRadius: 10,
                padding: "10px 24px", cursor: rating && text.trim() ? "pointer" : "not-allowed",
                fontWeight: 700, fontSize: 14, fontFamily: "inherit", transition: "background 0.2s",
              }}
            >
              {t("submit_review")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
