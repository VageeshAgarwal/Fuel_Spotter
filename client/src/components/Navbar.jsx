import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

export default function Navbar({ dark, setDark, showMap, setShowMap }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-50 backdrop-blur-xl bg-[#0b1220]/80 border-b border-white/10">
      <div className="w-full px-4 md:px-12 py-4 flex justify-between items-center">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-xl">⛽</span>
          <h1 className="text-xl font-bold text-white">{t("app_name")}</h1>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* 🟢 Online */}
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            <span className="text-sm text-gray-300">Online</span>
          </div>

          {/* 🌐 Language */}
          <select
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            className="bg-white/5 text-white text-sm px-3 py-1.5 rounded-lg border border-white/10"
          >
            <option value="en">EN</option>
            <option value="hi">HI</option>
            <option value="mr">MR</option>
            <option value="ta">TA</option>
          </select>

          {/* 🌙 Theme */}
          <button
            onClick={() => setDark(!dark)}
            className="px-3 py-1.5 rounded-lg text-sm bg-white/5 text-white border border-white/10"
          >
            {dark ? "☀️ Light" : "🌙 Dark"}
          </button>

          {/* 🗺 Map */}
          <button
            onClick={() => setShowMap(!showMap)}
            className="px-3 py-1.5 rounded-lg text-sm bg-white/5 text-white border border-white/10"
          >
            {showMap ? t("hide_map") : t("show_map")}
          </button>

          {/* 🔐 Logout */}
          <button
            onClick={() => {
              localStorage.removeItem("token");
              navigate("/auth");
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium 
            bg-red-500/10 text-red-400 border border-red-500/20
            hover:bg-red-500 hover:text-white"
          >
            {t("logout") || "Logout"}
          </button>
        </div>
      </div>
    </div>
  );
}
