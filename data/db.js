const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const db = low(new FileSync('./db.json'));

const map = Array(500);

for (let i = 0; i < 500; i++) {
  map[i] = {};
}

db.defaults({
  map,
  rooms: [],
  currentRoom: {},
  queue: [],
  cooldown: 0,
  timer: 0,
  timeout: false
}).write();

module.exports = db;
