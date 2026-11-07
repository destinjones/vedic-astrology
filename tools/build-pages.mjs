// Builds the site exactly as GitHub Pages serves it, from /vedic-astrology/.
import { execSync } from 'node:child_process';

execSync('npm run build -w @vedic/web', { stdio: 'inherit', env: { ...process.env, VITE_BASE: '/vedic-astrology/' } });
