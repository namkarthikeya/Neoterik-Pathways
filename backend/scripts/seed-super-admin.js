import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';

const email = String(process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase();
const password = String(process.env.SUPER_ADMIN_PASSWORD ?? '');
const name = String(process.env.SUPER_ADMIN_NAME ?? 'Super Admin').trim();

if (!email || !password || !name) {
  throw new Error('SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, and SUPER_ADMIN_NAME must be configured.');
}
if (email.endsWith('@example.com') || /replace|change.?me|password123/i.test(password)) {
  throw new Error('Use a real super-admin email and a unique secret password; template placeholders are not allowed.');
}
if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
  throw new Error('SUPER_ADMIN_PASSWORD must be at least 12 characters and no more than 72 UTF-8 bytes.');
}

try {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  const passwordHash = await bcrypt.hash(password, 12);
  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { name, password: passwordHash, role: 'SuperAdmin', status: 'APPROVED' }
    });
  } else {
    await prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
        role: 'SuperAdmin',
        status: 'APPROVED'
      }
    });
  }
} finally {
  await prisma.$disconnect();
}
