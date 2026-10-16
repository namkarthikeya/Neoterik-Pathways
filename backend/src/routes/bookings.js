import { Router } from 'express';
import { authenticate, requireRoles } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';

export const bookingsRouter = Router();
const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

const bookingInclude = {
  user: { select: { id: true, name: true, email: true, mobile: true } },
  admin: { select: { id: true, name: true, email: true, mobile: true } },
  messages: { orderBy: { createdAt: 'asc' } }
};

function serializeBooking(booking) {
  return {
    id: booking.id,
    studentId: booking.userId,
    studentName: booking.user?.name || booking.studentName || 'Unknown student',
    studentEmail: booking.user?.email || '',
    studentMobile: booking.user?.mobile || 'N/A',
    adminId: booking.adminId,
    adminEmail: booking.admin?.email || '',
    adminName: booking.admin?.name || 'Unassigned counselor',
    adminMobile: booking.admin?.mobile || 'N/A',
    slot: booking.slot || 'Unspecified time',
    type: booking.type || 'chat',
    status: booking.status,
    createdAt: booking.createdAt,
    acceptedBy: booking.status === 'ACCEPTED' && booking.admin
      ? { name: booking.admin.name, email: booking.admin.email, mobile: booking.admin.mobile || 'N/A' }
      : null,
    messages: booking.messages.map((message) => ({
      id: message.id,
      senderId: message.senderId,
      senderName: message.senderName,
      body: message.body,
      sentAt: message.createdAt
    }))
  };
}

bookingsRouter.use(authenticate);

bookingsRouter.get('/records', requireRoles('SuperAdmin'), asyncHandler(async (_request, response) => {
  const bookings = await prisma.booking.findMany({
    include: bookingInclude,
    orderBy: { createdAt: 'desc' }
  });
  response.json(bookings.map(serializeBooking));
}));

bookingsRouter.get('/', requireRoles('Student', 'Admin', 'SuperAdmin'), asyncHandler(async (request, response) => {
  const where = request.user.role === 'Student'
    ? { userId: request.user.id }
    : request.user.role === 'Admin'
      ? { adminId: request.user.id }
      : {};
  const bookings = await prisma.booking.findMany({
    where,
    include: bookingInclude,
    orderBy: { createdAt: 'desc' }
  });
  response.json(bookings.map(serializeBooking));
}));

bookingsRouter.post('/', requireRoles('Student'), asyncHandler(async (request, response) => {
  const slot = String(request.body?.slot ?? '').trim();
  const type = String(request.body?.type ?? '').trim();
  if (!slot || slot.length > 80 || !['chat', 'call'].includes(type)) {
    return response.status(400).json({ error: 'A valid slot and session type are required' });
  }

  const student = await prisma.user.findUnique({
    where: { id: request.user.id },
    select: { id: true, name: true, status: true, assignedAdminId: true }
  });
  if (student.status !== 'APPROVED' || !student.assignedAdminId) {
    return response.status(403).json({ error: 'A counselor must accept your registration before booking a session' });
  }

  const pending = await prisma.booking.findFirst({
    where: { userId: student.id, status: 'PENDING' },
    select: { id: true }
  });
  if (pending) {
    return response.status(409).json({ error: 'You already have a pending session request' });
  }

  const booking = await prisma.booking.create({
    data: {
      userId: student.id,
      adminId: student.assignedAdminId,
      studentName: student.name,
      slot,
      type,
      status: 'PENDING'
    },
    include: bookingInclude
  });
  response.status(201).json(serializeBooking(booking));
}));

bookingsRouter.patch('/:id/accept', requireRoles('Admin'), asyncHandler(async (request, response) => {
  const result = await prisma.booking.updateMany({
    where: { id: request.params.id, adminId: request.user.id, status: 'PENDING' },
    data: { status: 'ACCEPTED' }
  });
  if (result.count !== 1) {
    return response.status(409).json({ error: 'This session is no longer waiting for your approval' });
  }
  const booking = await prisma.booking.findUnique({
    where: { id: request.params.id },
    include: bookingInclude
  });
  response.json(serializeBooking(booking));
}));

bookingsRouter.post('/:id/messages', requireRoles('Student', 'Admin'), asyncHandler(async (request, response) => {
  const body = String(request.body?.body ?? '').trim();
  if (!body || body.length > 2000) {
    return response.status(400).json({ error: 'Message must contain 1 to 2000 characters' });
  }

  const booking = await prisma.booking.findFirst({
    where: {
      id: request.params.id,
      status: 'ACCEPTED',
      ...(request.user.role === 'Student'
        ? { userId: request.user.id }
        : { adminId: request.user.id })
    }
  });
  if (!booking) {
    return response.status(404).json({ error: 'Accepted session not found' });
  }

  const message = await prisma.bookingMessage.create({
    data: {
      bookingId: booking.id,
      senderId: request.user.id,
      senderName: request.user.name,
      body
    }
  });
  response.status(201).json({
    id: message.id,
    senderId: message.senderId,
    senderName: message.senderName,
    body: message.body,
    sentAt: message.createdAt
  });
}));
