import { Router } from 'express';

const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

export function createCrudRouter({
  model,
  requiredFields,
  allowedFields,
  serialize = (record) => record,
  middleware = [],
  beforeWrite = [],
  disableCreate = false
}) {
  const router = Router();
  if (middleware.length) {
    router.use(...middleware);
  }

  router.get('/', asyncHandler(async (_request, response) => {
    const records = await model.findMany({ orderBy: { createdAt: 'desc' } });
    response.json(records.map(serialize));
  }));

  router.get('/:id', asyncHandler(async (request, response) => {
    const record = await model.findUnique({ where: { id: request.params.id } });
    if (!record) return response.status(404).json({ error: 'Record not found' });
    response.json(serialize(record));
  }));

  if (disableCreate) {
    router.post('/', ...beforeWrite, (_request, response) => {
      response.status(405).json({ error: 'Creating records through this endpoint is not allowed' });
    });
  } else {
    router.post('/', ...beforeWrite, asyncHandler(async (request, response) => {
      const data = pickFields(request.body, allowedFields);
      const missing = requiredFields.filter((field) => !hasValue(data[field]));
      if (missing.length) {
        return response.status(400).json({ error: `Required fields: ${missing.join(', ')}` });
      }

      const record = await model.create({ data });
      response.status(201).json(serialize(record));
    }));
  }

  router.patch('/:id', ...beforeWrite, asyncHandler(async (request, response) => {
    const data = pickFields(request.body, allowedFields);
    if (!Object.keys(data).length) {
      return response.status(400).json({ error: 'Provide at least one editable field' });
    }

    const record = await model.update({ where: { id: request.params.id }, data });
    response.json(serialize(record));
  }));

  router.delete('/:id', ...beforeWrite, asyncHandler(async (request, response) => {
    await model.delete({ where: { id: request.params.id } });
    response.status(204).end();
  }));

  return router;
}

function pickFields(body, allowedFields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  return Object.fromEntries(
    allowedFields
      .filter((field) => Object.hasOwn(body, field))
      .map((field) => [field, body[field]])
  );
}

function hasValue(value) {
  return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;
}