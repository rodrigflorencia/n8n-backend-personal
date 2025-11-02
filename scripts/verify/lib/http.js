const axios = require('axios');

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

async function get(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  return axios.get(url, opts).then(r => ({ status: r.status, data: r.data })).catch(e => {
    if (e.response) return { status: e.response.status, data: e.response.data };
    throw e;
  });
}

async function post(path, body = {}, opts = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  return axios.post(url, body, opts).then(r => ({ status: r.status, data: r.data })).catch(e => {
    if (e.response) return { status: e.response.status, data: e.response.data };
    throw e;
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { get, post, sleep, BASE_URL };
