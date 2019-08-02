const axios = require('axios');

const serverHandshake = axios.create({
  baseURL: process.env.API_SERVER,
  headers: {
    authorization: `Token ${process.env.API_KEY}`
  }
});

module.exports = serverHandshake;
