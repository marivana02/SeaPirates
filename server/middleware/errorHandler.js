const response = require('../helpers/response');

function errorHandler(err, req, res, _next) {
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  if (err.type === 'entity.parse.failed') {
    return response.badRequest(res, 'Invalid JSON in request body');
  }

  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEOUT') {
    return response.error(res, 'Database connection error', 503);
  }

  if (err.code && err.code.startsWith('235')) {
    return response.badRequest(res, 'Server error');
  }

  response.error(res, 'Server error', 500);
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, asyncHandler };
