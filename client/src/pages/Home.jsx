import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function Home() {
  const [location, setLocation] = useState(null);
  const [pumps, setPumps] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1️⃣ Get user location
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        setLocation({ lat: 26.9124, lng: 75.7873 }); // Jaipur fallback
      },
    );
  }, []);

  // 2️⃣ Fetch petrol pumps
  useEffect(() => {
    if (!location) return;

    const query = `
      [out:json];
      node(around:5000,${location.lat},${location.lng})["amenity"="fuel"];
      out;
    `;

    fetch("https://overpass.kumi.systems/api/interpreter", {
      method: "POST",
      body: query,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Overpass error");
        return res.json();
      })
      .then((data) => {
        const enriched = (data.elements || []).map((pump) => ({
          ...pump,
          distance: getDistanceKm(
            location.lat,
            location.lng,
            pump.lat,
            pump.lon,
          ),
        }));

        enriched.sort((a, b) => a.distance - b.distance);
        setPumps(enriched);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [location]);

  // 3️⃣ UI (JSX ONLY HERE)
  return (
    <>
      <Navbar />

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-10">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-2">Nearby Petrol Pumps</h2>
          <p className="text-gray-600 mb-8">
            Showing fuel stations closest to you
          </p>

          {loading && <p>Loading petrol pumps...</p>}

          <div className="grid gap-6 sm:grid-cols-2">
            {pumps.map((pump) => (
              <div
                key={pump.id}
                className="bg-white rounded-2xl shadow-sm hover:shadow-md transition p-6"
              >
                <h3 className="text-lg font-semibold mb-1">
                  {pump.tags?.name || "Petrol Pump"}
                </h3>

                <p className="text-sm text-gray-500 mb-3">
                  {pump.tags?.addr?.street || "Near Highway"}
                </p>

                <div className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded-full inline-block">
                  {pump.distance.toFixed(2)} km away
                </div>

                <button
                  onClick={() =>
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${pump.lat},${pump.lon}`,
                      "_blank",
                    )
                  }
                  className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl"
                >
                  Get Directions
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
