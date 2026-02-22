#!/usr/bin/env node
// Docker HEALTHCHECK script for Claude Work
// Usage: node scripts/healthcheck.js
const port = process.env.PORT || 3000;

require('http')
  .get(`http://127.0.0.1:${port}/api/health`, function (r) {
    process.exit(r.statusCode === 200 ? 0 : 1);
  })
  .on('error', function () {
    process.exit(1);
  });
