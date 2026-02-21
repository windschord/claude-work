#!/usr/bin/env node
// Docker HEALTHCHECK script for Claude Work
// Usage: node scripts/healthcheck.js
require('http')
  .get('http://localhost:3000/api/health', function (r) {
    process.exit(r.statusCode === 200 ? 0 : 1);
  })
  .on('error', function () {
    process.exit(1);
  });
