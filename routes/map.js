const router = require('express').Router();
const map = require('../models/map');

router.get('/', async (req, res) => {
  return res.status(200).json(map.get());
});

module.exports = router;
