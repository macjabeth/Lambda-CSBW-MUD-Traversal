require('dotenv').config();

const server = require('./api/server');
const serverHandshake = require('./api/handshake');
const db = require('./data/db');
const port = process.env.PORT || 9000;

server.listen(port, async () => {
  console.log(
    '=== Listening on port %d in %s mode ===',
    port,
    server.settings.env
  );

  try {
    // get information for our current room
    let response = await serverHandshake.get('/adv/init/');
    if (response.data) handleRoomInfo(response.data);
  } catch (error) {
    console.log('ERROR:', error);
  }

  // start a timer for any actions needing to be done
  setInterval(() => {
    // this will be set to true if we're on a cooldown
    if (db.get('timeout').value()) return;

    const queue = db.get('queue');

    // if we have input from the frontend
    if (queue.size().value() > 0) {
      const command = queue.value().pop();
      // do something with that command
      db.write();
    } else {
      // calculate our delay based off the cooldown
      const delay = db.get('cooldown').value() * 1000;

      // run our next action after a cooldown
      setTimeout(async () => {
        let room = db.get('currentRoom').value();
        let nextMove = getUnexploredDir(room);
        let nextRoomID;

        if (!nextMove) {
          // find the nearest unexplored path
          const pathToRoom = findUnexploredPath(room);
          if (pathToRoom && pathToRoom.length > 0) {
            // grab the destinations
            const dirsToMove = convertPath(pathToRoom);
            // set the next move to the first direction
            nextMove = dirsToMove[0];
            nextRoomID = pathToRoom[1].room_id;
          } else {
            console.log("=== We've explored everything! ===");
          }
        } else {
          let count = 0;
          const map = db.get('map').value();
          for (const room of map) {
            if (Object.keys(room).length > 0) count++;
          }
          console.log(`You have ${500 - count} rooms left to explore.`);
        }

        if (nextMove) {
          // next_room_id
          const payload = { direction: nextMove };

          // Do we know the id of our next room?
          if (Number.isInteger(nextRoomID)) {
            payload.next_room_id = nextRoomID.toString();
          }

          try {
            const response = await serverHandshake.post('/adv/move/', payload);

            if (response.data) {
              const curRoomID = db.get('currentRoom.room_id').value();
              handleRoomInfo(response.data);
              handleMap(curRoomID, nextMove, response.data.room_id);
            }

            db.set('timeout', false).write();
          } catch (error) {
            console.error(error);
          }
        }
      }, delay);

      // activate the timeout while we wait
      db.set('timeout', true).write();
    }
  }, 1000);
});

// given a room, find any unexplored directions
function getUnexploredDir(currentRoom) {
  const exits = currentRoom.exits;
  const map = db.get(`map[${currentRoom.room_id}]`).value();
  if (exits) {
    for (const dir of exits) {
      if (map[dir] === '?') return dir;
    }
  }

  return false;
}

const getReverseDir = { n: 's', s: 'n', e: 'w', w: 'e' };

function handleMap(curRoom, dir, nextRoom) {
  const map = db.get('map').value();
  map[curRoom][dir] = nextRoom;
  map[nextRoom][getReverseDir[dir]] = curRoom;
  db.write();
}

function handleRoomInfo(data) {
  console.log(data);
  // current room
  db.set('currentRoom', data).write();
  // save room info
  db.set(`rooms[${data.room_id}]`, data).write();
  // set cooldown
  db.set('cooldown', data.cooldown).write();
  // update map with valid exits
  const map = db.get('map').value();
  for (const dir of data.exits) {
    if (!map[data.room_id][dir] || !Number.isInteger(map[data.room_id][dir])) {
      map[data.room_id][dir] = '?';
    }
  }
  db.write();
}

function getRoomInDirection(curRoom, dir) {
  const map = db.get(`map[${curRoom}]`).value();
  const roomID = map[dir];

  return roomID === '?' ? false : db.get(`rooms[${roomID}]`).value();
}

function findUnexploredPath(room) {
  const rooms = db.get('rooms').value();
  const map = db.get('map').value();
  const queue = [[room]];
  const visited = new Set();
  while (queue.length > 0) {
    const path = queue.shift();
    const r = path[path.length - 1];
    if (!visited.has(r)) {
      visited.add(r);
      for (const x of r.exits) {
        const neighbor = map[r.room_id][x];
        if (neighbor === '?') {
          return path;
        } else {
          const path_copy = path.slice();
          path_copy.push(rooms[neighbor]);
          queue.push(path_copy);
        }
      }
    }
  }
}

function convertPath(rooms) {
  const map = db.get('map').value();
  const path = [];
  let current = rooms[0];
  for (let i = 1; i < rooms.length; i++) {
    const nextRoom = rooms[i];
    for (const x of current.exits) {
      if (nextRoom.room_id === map[current.room_id][x]) {
        path.push(x);
        current = nextRoom;
        break;
      }
    }
  }
  return path;
}
