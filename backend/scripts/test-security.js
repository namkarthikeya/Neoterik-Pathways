import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = fileURLToPath(new URL('../', import.meta.url));
const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'neoterik-security-test-'));
const databasePath = path.join(temporaryDirectory, 'security.db').replaceAll('\\', '/');
const environment = {
  ...process.env,
  DATABASE_URL: `file:${databasePath}`,
  JWT_SECRET: 'security-test-only-secret-with-at-least-32-bytes',
  NODE_ENV: 'test',
  SUPER_ADMIN_EMAIL: 'root@example.test'
};

function runNode(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: backendRoot,
    env: environment,
    encoding: 'utf8'
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  return result.status === 0;
}

try {
  const schemaPushSucceeded = runNode([
    path.join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js'),
    'db',
    'push',
    '--schema=prisma/schema.prisma',
    '--skip-generate'
  ]);
  if (schemaPushSucceeded) {
    runNode(['--test', 'test/security.test.js']);
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

if (process.exitCode) process.exit(process.exitCode);
