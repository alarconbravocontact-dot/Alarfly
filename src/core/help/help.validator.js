const { z } = require('zod');

const contextQuerySchema = z.object({
  moduleKey: z.string().min(1, 'Debes indicar el módulo actual.'),
});

const askQuestionSchema = z.object({
  moduleKey: z.string().min(1, 'Debes indicar el módulo actual.'),
  questionText: z.string().min(3, 'Escribe tu pregunta con al menos unas palabras.').max(500),
});

module.exports = { contextQuerySchema, askQuestionSchema };
