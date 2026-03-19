const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Pump = require('../models/Pump');

router.get('/', auth, async (req,res)=>{
  const user = await User.findById(req.user.id);
  const pumps = await Pump.find({_id: {$in: user.favorites}});
  res.json(pumps);
});

router.post('/', auth, async (req,res)=>{
  await User.findByIdAndUpdate(req.user.id,{
    $addToSet:{favorites:req.body.pumpId}
  });
  res.json("Added");
});

router.delete('/:id', auth, async (req,res)=>{
  await User.findByIdAndUpdate(req.user.id,{
    $pull:{favorites:req.params.id}
  });
  res.json("Removed");
});

module.exports = router;
