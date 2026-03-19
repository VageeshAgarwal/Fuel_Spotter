const express = require("express");
const Pump = require("../models/Pump");
const { getDistance } = require("geolib");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { lat, lng } = req.query;

    const pumps = await Pump.find();

    // If no location provided, return pumps directly
    if (!lat || !lng) {
      return res.json(pumps);
    }

    const userLat = Number(lat);
    const userLng = Number(lng);

    const result = [];

    for (const pump of pumps) {
      // SAFETY CHECK
      if (
        !pump.location ||
        pump.location.lat == null ||
        pump.location.lng == null
      ) {
        continue; // skip broken record
      }

      const distance =
        getDistance(
          { latitude: userLat, longitude: userLng },
          {
            latitude: Number(pump.location.lat),
            longitude: Number(pump.location.lng),
          }
        ) / 1000;

      result.push({
        ...pump.toObject(),
        distance,
      });
    }

    // Sort by nearest
    // AFTER distance is calculated and pushed
result.sort((a, b) => {
  if (a.distance === undefined) return 1;
  if (b.distance === undefined) return -1;
  return a.distance - b.distance;
});


    res.json(result);
  } catch (error) {
    console.error("PUMPS ROUTE ERROR:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
