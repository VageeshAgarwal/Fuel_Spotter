const mongoose = require('mongoose');

module.exports = mongoose.model("Pump", new mongoose.Schema({
  name: String,
  location: {
    lat: Number,
    lng: Number,
    address: String,
    highway: String
  },
  fuels: [String],
  amenities: [String],
  price: Object,
  verified: Boolean,
  open_24_7: Boolean,
  phone: String,
  image: String
}));
