const map = require('./map');

module.exports = server => {
  server.use('/api/map', map);
  server.get(/\/(?:api)?$/, (req, res) => {
    res.status(200).json({ message: 'Server up & running!' });
  });
}
