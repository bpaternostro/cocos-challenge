/**
 * Wraps async route handlers/controllers and forwards rejections to Express error middleware.
 * @param {import('express').RequestHandler} fn
 * @returns {import('express').RequestHandler}
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
