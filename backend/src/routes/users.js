import { Router } from 'express';
import { authenticate, requireRoles } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { withoutPassword } from '../lib/users.js';

export const usersRouter = Router();
const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

usersRouter.use(authenticate);

usersRouter.get('/dashboard', requireRoles('Admin'), asyncHandler(async (request, response) => {
  const [pendingStudents, assignedStudents] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'Student', status: 'PENDING', assignedAdminId: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, mobile: true, presentClass: true, degree: true, status: true }
    }),
    prisma.user.findMany({
      where: { role: 'Student', status: 'APPROVED', assignedAdminId: request.user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, mobile: true, presentClass: true, degree: true, status: true }
    })
  ]);
  response.json({ pendingStudents, assignedStudents });
}));

usersRouter.get('/', requireRoles('SuperAdmin'), asyncHandler(async (_request, response) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { assignedAdmin: { select: { id: true, name: true, email: true } } }
  });
  response.json(users.map(withoutPassword));
}));

usersRouter.patch('/students/:id/approve', requireRoles('Admin'), asyncHandler(async (request, response) => {
  const result = await prisma.user.updateMany({
    where: {
      id: request.params.id,
      role: 'Student',
      status: 'PENDING',
      assignedAdminId: null
    },
    data: { status: 'APPROVED', assignedAdminId: request.user.id }
  });
  if (result.count !== 1) {
    return response.status(409).json({ error: 'This student is no longer waiting for approval' });
  }

  const student = await prisma.user.findUnique({
    where: { id: request.params.id },
    select: { id: true, name: true, email: true, mobile: true, presentClass: true, degree: true, status: true }
  });
  response.json(student);
}));

usersRouter.patch('/:id', requireRoles('SuperAdmin'), asyncHandler(async (request, response) => {
  const { status } = request.body ?? {};
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return response.status(400).json({ error: 'Status must be APPROVED or REJECTED' });
  }

  const result = await prisma.user.updateMany({
    where: { id: request.params.id, role: 'Admin', status: 'PENDING' },
    data: { status }
  });
  if (result.count !== 1) {
    return response.status(409).json({ error: 'This admin is not awaiting approval' });
  }

  const admin = await prisma.user.findUnique({
    where: { id: request.params.id },
    select: { id: true, name: true, email: true, mobile: true, role: true, status: true }
  });
  response.json(admin);
}));

usersRouter.delete('/:id', requireRoles('SuperAdmin'), asyncHandler(async (request, response) => {
  const result = await prisma.user.deleteMany({
    where: { id: request.params.id, role: { in: ['Student', 'Admin'] } }
  });
  if (result.count !== 1) {
    return response.status(404).json({ error: 'Student or admin account not found' });
  }

  response.status(204).end();
}));
