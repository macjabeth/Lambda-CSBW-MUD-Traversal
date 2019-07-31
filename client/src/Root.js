import React, { useEffect } from 'react';
import './root.css';

function Root() {
  // init request
  useEffect(() => {

  }, []);

  return (
    <div className="app">
      <div>
        {/* <MapWindow /> */}
        <p>Map Window</p>
        {/* <CharStatusWindow /> */}
        <p>Character Status Window</p>
      </div>
      <div className="middle">
        {/* <DisplayWindow /> */}
        <p>Display Window</p>
        {/* <CommandInput /> */}
        <p>Command Input</p>
      </div>
      <div>
        {/* <RoomInfo /> */}
        <p>Room Info (players, items, etc.)</p>
      </div>
    </div>
  );
}

export default Root;
