const router = require('express').Router();
const Pump = require('../models/Pump');

router.post('/pumps', async (req,res)=>{
  const pump = await Pump.create(req.body);
  res.json(pump);
});

router.delete('/pumps/:id', async (req,res)=>{
  await Pump.findByIdAndDelete(req.params.id);
  res.json("Deleted");
});

module.exports = router;
