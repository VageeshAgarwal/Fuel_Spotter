import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Auth from "./pages/Auth";
import SearchResults from "./pages/SearchResults";
import PumpDetail from "./pages/PumpDetail";
import Favorites from "./pages/Favorites";
import Admin from "./pages/Admin";

function App() {
  // 🔐 get token from browser storage
  const token = localStorage.getItem("token");

  return (
    <BrowserRouter>
      <Routes>
        {/* ✅ PUBLIC ROUTE */}
        <Route path="/auth" element={<Auth />} />

        {/* ✅ PROTECTED ROUTES */}
        {token ? (
          <>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/pump/:id" element={<PumpDetail />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/admin" element={<Admin />} />
          </>
        ) : (
          /* ❌ If NOT logged in → redirect everything to Auth */
          <Route path="*" element={<Auth />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
