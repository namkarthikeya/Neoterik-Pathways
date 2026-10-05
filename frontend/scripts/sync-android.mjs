import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const apiBaseUrl = process.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error('Set VITE_API_BASE_URL to your production HTTPS API URL, including /api, before syncing Android.');
}

let parsedApiUrl;
try {
  parsedApiUrl = new URL(apiBaseUrl);
} catch {
  throw new Error('VITE_API_BASE_URL must be a valid absolute HTTPS URL ending in /api.');
}

if (parsedApiUrl.protocol !== 'https:' || !parsedApiUrl.pathname.replace(/\/+$/, '').endsWith('/api')) {
  throw new Error('VITE_API_BASE_URL must use HTTPS and include /api, for example https://api.example.com/api.');
}

const commands = [
  ['node_modules/vite/bin/vite.js', ['build']],
  ['node_modules/@capacitor/cli/bin/capacitor', ['sync', 'android']]
];

for (const [script, args] of commands) {
  const result = spawnSync(process.execPath, [path.join(projectRoot, script), ...args], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
