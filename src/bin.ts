#!/usr/bin/env node

/**
 * Binary entry point for npx execution
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the path to the main index.js file
const indexPath = join(__dirname, 'index.js');

// Pass through all arguments and environment
const child = spawn(process.execPath, [indexPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});