const AppError = require('../utils/AppError');

// Middleware genérico: valida req.body (o req.query) contra un schema
// de Zod. Si algo está mal, responde con un mensaje claro en vez de
// dejar que el error llegue crudo a los servicios.
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const field = firstIssue.path.join('.') || source;
      throw new AppError(`Dato inválido en "${field}": ${firstIssue.message}`, 400, 'VALIDATION_ERROR');
    }
    req[source] = result.data;
    next();
  };
}

module.exports = validate;
