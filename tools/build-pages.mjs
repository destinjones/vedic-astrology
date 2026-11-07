// Builds the site exactly as GitHub Pages serves it, from /vedic-astrology/.
import { execSync } from 'node:child_process';

execSync('npm run build -w @vedic/web', { stdio: 'inherit', env: { ...process.env, VITE_BASE: '/vedic-astrology/' } });
// Panchanga subscription feeds, one per city, rebuilt on every deploy so they stay a year ahead.
execSync('npm run feeds -w @vedic/personal -- ../../apps/web/dist/feeds', { stdio: 'inherit' });

// The engine's API reference, at /vedic-astrology/docs/engine/.
execSync('npm run docs -w @vedic/engine', { stdio: 'inherit' });
