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
    // sanity checks
    if (!db.get('explored').value()) resetExplorationMap();
    db.set('timeout', false).write();

    // get information for our current room
    let response = await serverHandshake.get('/adv/init/');
    if (response.data) handleRoomInfo(response.data);
  } catch (error) {
    console.log('ERROR:', error);
  }

  ENCUMBERED = 'Heavily Encumbered: +100% CD';
  NOITEMS = 'Item not found: +5s CD';

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

        if (db.get('profiteer').value()) {
          const valuables = ['treasure', 'flower'];

          for (const item of room.items) {
            for (const valuable of valuables) {
              if (item.includes(valuable)) {
                const response = await serverHandshake.post('/adv/take/', {
                  name: valuable
                });

                handleRoomInfo(response.data);
                db.set('timeout', false).write();
                if (response.data.messages.includes(ENCUMBERED)) {
                  db.set('encumbered', true).write();
                }
                return;
              }
            }
          }
        }

        let nextMove, nextRoomID;

        if (db.get('changeName').value()) {
          if (room.room_id === 467) {
            console.log("=== We're here! ===");
            if (!db.get('nameChanged').value()) {
              const confirm = db.get('confirm').value();
              const payload = { name: 'Belgarath' };

              if (confirm) {
                payload.confirm = 'aye';
                db.set('nameChanged', true).write();
              }

              const response = await serverHandshake.post('/adv/change_name/', payload);

              db.set('confirm', !confirm).write();

              handleRoomInfo(response.data);
            }
          } else {
            console.log('Traversing to the Pirate...');
            const pathToRoom = findPathToDest(room, 467);
            const dirsToMove = convertPath(pathToRoom);
            nextMove = dirsToMove[0];
            nextRoomID = pathToRoom[1].room_id;
          }
      } else if (db.get('encumbered').value()) {
          if (room.room_id === 1) {
            const confirm = db.get('confirm').value();
            const payload = { name: 'treasure' };

            if (confirm) {
              payload.confirm = 'yes';
            }

            const response = await serverHandshake.post('/adv/sell/', payload);

            db.set('confirm', !confirm).write();

            handleRoomInfo(response.data);

            if (response.data.errors.includes(NOITEMS))
              db.set('encumbered', false).write();
          } else {
            console.log('Traversing to the Shop...');
            const pathToRoom = findPathToDest(room, 1);
            const dirsToMove = convertPath(pathToRoom);
            nextMove = dirsToMove[0];
            nextRoomID = pathToRoom[1].room_id;
          }
        } else {
          [nextMove, nextRoomID] = getUnexploredDir(room);

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
              // set our finished map
              // db.set('map', explored).write();
              resetExplorationMap();
              // set our profiteer status
              db.set('profiteer', true).write();
            }
          } else {
            let count = 0;
            const explored = db.get('explored').value();
            for (const room of explored) {
              if (Object.keys(room).length > 0) count++;
            }
            console.log(`You have ${500 - count} rooms left to explore.`);
          }
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
              if (response.data.messages.includes(ENCUMBERED))
                db.set('encumbered', true).write();
            }
          } catch (error) {
            console.error(error);
            return;
          }
        }

        db.set('timeout', false).write();
      }, delay);

      // activate the timeout while we wait
      db.set('timeout', true).write();
    }
  }, 1000);
});

// given a room, find any unexplored directions
function getUnexploredDir(currentRoom) {
  const exits = currentRoom.exits;
  const map = db.get('map').value();
  const explored = db.get(`explored[${currentRoom.room_id}]`).value();
  if (exits) {
    for (const dir of exits) {
      if (explored[dir] === '?') {
        let response = [dir];
        if (map) response.push(map[currentRoom.room_id][dir]);
        return response;
      }
    }
  }

  return [false, false];
}

const getReverseDir = { n: 's', s: 'n', e: 'w', w: 'e' };

function handleMap(curRoom, dir, nextRoom) {
  const explored = db.get('explored').value();
  explored[curRoom][dir] = nextRoom;
  explored[nextRoom][getReverseDir[dir]] = curRoom;
  db.write();
}

function resetExplorationMap() {
  const explored = [];
  for (let i = 0; i < 500; i++) explored[i] = {};
  db.set('explored', explored).write();
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
  const explored = db.get('explored').value();
  for (const dir of data.exits) {
    if (
      !explored[data.room_id][dir] ||
      !Number.isInteger(explored[data.room_id][dir])
    ) {
      explored[data.room_id][dir] = '?';
    }
  }
  db.write();
}

function getRoomInDirection(curRoom, dir) {
  const explored = db.get(`explored[${curRoom}]`).value();
  const roomID = explored[dir];

  return roomID === '?' ? false : db.get(`rooms[${roomID}]`).value();
}

function findUnexploredPath(room) {
  const rooms = db.get('rooms').value();
  const explored = db.get('explored').value();
  const queue = [[room]];
  const visited = new Set();
  while (queue.length > 0) {
    const path = queue.shift();
    const r = path[path.length - 1];
    if (!visited.has(r)) {
      visited.add(r);
      for (const x of r.exits) {
        const neighbor = explored[r.room_id][x];
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

function findPathToDest(room, target) {
  const rooms = db.get('rooms').value();
  const map = db.get('map').value();
  const queue = [[room]];
  const visited = new Set();
  while (queue.length > 0) {
    const path = queue.shift();
    const r = path[path.length - 1];
    if (r.room_id === target) return path;
    if (!visited.has(r)) {
      visited.add(r);
      for (const x of r.exits) {
        const neighbor = map[r.room_id][x];
        const path_copy = path.slice();
        path_copy.push(rooms[neighbor]);
        queue.push(path_copy);
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
