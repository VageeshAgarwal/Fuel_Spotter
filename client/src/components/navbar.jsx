export default function Navbar() {
  return (
    <div className="sticky top-0 z-50 backdrop-blur bg-white/80 border-b">
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Fuel<span className="text-blue-600">Spotter</span>
        </h1>

        <button
          onClick={() => {
            localStorage.removeItem("token");
            window.location.href = "/auth";
          }}
          className="text-sm font-medium text-red-500 hover:text-red-600"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
