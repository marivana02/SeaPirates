const response = {
  success(res, data = null, status = 200) {
    return res.status(status).json(data);
  },

  error(res, message = 'Server error', status = 500, details = null) {
    const body = { error: message };
    if (details && process.env.NODE_ENV !== 'production') {
      body.details = details;
    }
    return res.status(status).json(body);
  },

  badRequest(res, message) {
    return response.error(res, message, 400);
  },

  unauthorized(res, message = 'Unauthorized') {
    return response.error(res, message, 401);
  },

  notFound(res, message = 'Not found') {
    return response.error(res, message, 404);
  },

  tooMany(res, message, retryAfter) {
    const body = { error: message };
    if (retryAfter) body.retryAfter = retryAfter;
    return res.status(429).json(body);
  }
};

module.exports = response;
