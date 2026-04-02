export default function Navbar() {
  return (
    <div className="sticky top-0 z-50 backdrop-blur-xl bg-[#0b1220]/80 border-b border-white/10">
      {/* 🔥 Reduced left padding + wider layout */}
      <div className="w-full px-0 md:px-12 py-4 flex justify-between items-center">
        {/* Logo */}
        <div className="flex items-center gap-2 ml-1">
          <span className="text-xl">⛽</span>
          <h1 className="text-2xl font-bold tracking-wide text-white">
            FUEL <span className="text-orange-500">SPOTTER</span>
          </h1>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            <span className="text-sm text-gray-300">Online</span>
          </div>

          <button
            onClick={() => {
              localStorage.removeItem("token");
              window.location.href = "/auth";
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium 
            bg-red-500/10 text-red-400 border border-red-500/20
            hover:bg-red-500 hover:text-white transition-all duration-300"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
