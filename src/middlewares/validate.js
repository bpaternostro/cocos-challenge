import { AppError } from '../utils/AppError.js';

/**
 * Validates req.body, req.query, req.params, and req.headers against a Zod schema.
 * Strips unknown properties in parsed sections to prevent mass assignment.
 * @param {import('zod').ZodTypeAny} schema
 * @returns {import('express').RequestHandler}
 */
export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
    headers: req.headers,
  });

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return next(new AppError(400, 'Validation error', details));
  }

  if (result.data.body !== undefined) req.body = result.data.body;
  if (result.data.query !== undefined) req.query = result.data.query;
  if (result.data.params !== undefined) req.params = result.data.params;

  return next();
};
