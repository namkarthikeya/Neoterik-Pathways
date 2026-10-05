import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authenticate, createAccessToken } from './lib/auth.js';
import { withoutPassword } from './lib/users.js';
import { bookingsRouter } from './routes/bookings.js';
import { collegesRouter } from './routes/colleges.js';
import { usersRouter } from './routes/users.js';
import { prisma } from './lib/prisma.js';

export const app = express();

const allowedOrigins = new Set([
  process.env.CLIENT_ORIGIN
    ? (/^https?:\/\//i.test(process.env.CLIENT_ORIGIN)
      ? process.env.CLIENT_ORIGIN
      : `https://${process.env.CLIENT_ORIGIN}`).replace(/\/+$/, '')
    : null,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://localhost'
].filter(Boolean));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});

const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

app.get('/', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'Neoterik Pathways API',
    message: 'Backend is running.',
    endpoints: ['/api/health', '/api/users', '/api/bookings', '/api/colleges']
  });
});

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.post('/api/auth/register', authRateLimit, async (request, response) => {
  const payload = request.body ?? {};
  const name = String(payload.name ?? '').trim();
  const email = String(payload.email ?? '').trim().toLowerCase();
  const password = String(payload.password ?? '');
  const mobile = String(payload.mobile ?? '').trim();
  const role = String(payload.role ?? 'Student');
  const presentClass = payload.presentClass ?? null;
  const degree = payload.degree ?? null;

  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
    return response.status(400).json({ error: 'Name, email, and password are required' });
  }
  if (!['Student', 'Admin'].includes(role)) {
    return response.status(400).json({ error: 'Registration role must be Student or Admin' });
  }
  if (email === String(process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase()) {
    return response.status(409).json({ error: 'This email is reserved for the super-admin account' });
  }
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    return response.status(400).json({ error: 'Password must be at least 12 characters and no more than 72 UTF-8 bytes' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return response.status(409).json({ error: 'An account with this email already exists' });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: await bcrypt.hash(password, 12),
      mobile: mobile || null,
      presentClass: role === 'Student' ? presentClass : null,
      degree: role === 'Student' ? degree : null,
      role,
      status: 'PENDING'
    }
  });

  const token = role === 'Student' ? await createAccessToken(user.id) : null;
  return response.status(201).json({
    message: role === 'Admin' ? 'Admin registration submitted for approval.' : 'Registration successful.',
    user: withoutPassword(user),
    token
  });
});

app.post('/api/auth/login', authRateLimit, async (request, response) => {
  const payload = request.body ?? {};
  const email = String(payload.email ?? '').trim().toLowerCase();
  const password = String(payload.password ?? '');

  if (!email || !password) {
    return response.status(400).json({ error: 'Email and password are required' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return response.status(401).json({ error: 'Invalid email or password' });
  }

  const isBcryptHash = /^\$2[aby]\$/.test(user.password);
  const passwordMatches = isBcryptHash
    ? await bcrypt.compare(password, user.password)
    : password === user.password;
  if (!passwordMatches) {
    return response.status(401).json({ error: 'Invalid email or password' });
  }
  if (!isBcryptHash) {
    await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(password, 12) }
    });
  }

  if (user.role === 'Admin' && user.status !== 'APPROVED') {
    return response.status(403).json({
      error: user.status === 'REJECTED'
        ? 'Your admin registration was not approved.'
        : 'Your admin account is awaiting approval.'
    });
  }

  return response.json({
    user: withoutPassword(user),
    token: await createAccessToken(user.id)
  });
});

app.get('/api/auth/profile', authenticate, asyncHandler(async (request, response) => {
  const user = await prisma.user.findUnique({
    where: { id: request.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      mobile: true,
      presentClass: true,
      degree: true,
      role: true,
      status: true,
      assignedAdmin: {
        select: { id: true, name: true, email: true, mobile: true }
      }
    }
  });
  response.json({ user });
}));

app.patch('/api/auth/profile', authenticate, asyncHandler(async (request, response) => {
  const payload = request.body ?? {};
  const name = String(payload.name ?? '').trim();
  const mobile = String(payload.mobile ?? '').trim();
  const password = String(payload.password ?? '');

  if (!name || !mobile) {
    return response.status(400).json({ error: 'Name and mobile number are required' });
  }
  if (password && (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72)) {
    return response.status(400).json({ error: 'Password must be at least 12 characters and no more than 72 UTF-8 bytes' });
  }

  const data = { name, mobile };
  if (request.user.role === 'Student') {
    data.presentClass = String(payload.presentClass ?? '').trim() || null;
    data.degree = String(payload.degree ?? '').trim() || null;
  }
  if (password) {
    data.password = await bcrypt.hash(password, 12);
  }

  const user = await prisma.user.update({
    where: { id: request.user.id },
    data,
    include: {
      assignedAdmin: {
        select: { id: true, name: true, email: true, mobile: true }
      }
    }
  });
  response.json({ user: withoutPassword(user) });
}));

app.use('/api/users', usersRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/colleges', collegesRouter);

app.use((_request, response) => {
  response.status(404).json({ error: 'Route not found' });
});

app.use((error, _request, response, _next) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return response.status(409).json({ error: 'A record with that unique value already exists' });
    }
    if (error.code === 'P2025') {
      return response.status(404).json({ error: 'Record not found' });
    }
    if (error.code === 'P2003') {
      return response.status(400).json({ error: 'The referenced user does not exist' });
    }
  }

  if (error instanceof SyntaxError && 'body' in error) {
    return response.status(400).json({ error: 'Request body must be valid JSON' });
  }

  console.error(error);
  response.status(500).json({ error: 'Internal server error' });
});