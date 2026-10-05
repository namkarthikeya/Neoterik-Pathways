import { Router } from 'express';
import { authenticate, requireRoles } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';

export const collegesRouter = Router();
const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

collegesRouter.use(authenticate, requireRoles('SuperAdmin'));

collegesRouter.get('/', asyncHandler(async (_request, response) => {
  response.json(await prisma.college.findMany({ orderBy: { createdAt: 'desc' } }));
}));

collegesRouter.post('/', asyncHandler(async (request, response) => {
  const name = String(request.body?.name ?? '').trim();
  if (!name) return response.status(400).json({ error: 'College name is required' });
  if (name.length > 200) return response.status(400).json({ error: 'College name must be at most 200 characters' });

  const college = await prisma.college.create({
    data: {
      name,
      cutoff: String(request.body?.cutoff ?? '').trim() || null,
      location: String(request.body?.location ?? '').trim() || null
    }
  });
  response.status(201).json(college);
}));
