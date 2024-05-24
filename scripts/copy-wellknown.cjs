#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const fs = require('fs');

const wellKnownPath = path.join(__dirname, '../.well-known');

console.log('Copying .well-known/ contents to apps');
fs.cpSync(wellKnownPath, path.join(__dirname, '../apps/web/public/.well-known'), {
  recursive: true,
});

fs.cpSync(wellKnownPath, path.join(__dirname, '../apps/marketing/public/.well-known'), {
  recursive: true,
});
