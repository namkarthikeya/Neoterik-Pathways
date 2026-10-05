import 'dotenv/config';
import { app } from './app.js';
import { prisma } from './lib/prisma.js';

if (process.env.NODE_ENV === 'production') {
  const required = ['JWT_SECRET', 'SUPER_ADMIN_NAME', 'SUPER_ADMIN_EMAIL', 'SUPER_ADMIN_PASSWORD', 'CLIENT_ORIGIN'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
  if (Buffer.byteLength(process.env.JWT_SECRET, 'utf8') < 32) {
    throw new Error('JWT_SECRET must contain at least 32 UTF-8 bytes in production');
  }
}

const port = Number(process.env.PORT ?? 4000);
const server = app.listen(port, () => {
  console.log(`Neoterik Pathways API listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);