const db = require('../data/db');
const Joi = require('@hapi/joi');

module.exports = {
  get
};

function get() {
  const map = db.get('map').value();
  const rooms = db.get('rooms').value();
  const mapWithCoords = [];

  for (let i = 0; i < 500; i++) {
    if (rooms[i]) {
      const match = rooms[i].coordinates.match(/(\d+),(\d+)/);
      mapWithCoords[i] = [[match[1], match[2]], map[i]];
    }
  }

  return mapWithCoords;
}
