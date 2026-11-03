'use strict';
// Vercel serverless entry point. vercel.json rewrites every request here as
// /api?__path=<original path>&<original query>, so restore the original URL first.
const { handle } = require('../src/server');

module.exports = (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const original = url.searchParams.get('__path');
  if (original !== null) {
    url.searchParams.delete('__path');
    const query = url.searchParams.toString();
    req.url = `/${original.replace(/^\/+/, '')}${query ? `?${query}` : ''}`;
  }
  return handle(req, res);
};
