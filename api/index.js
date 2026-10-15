// Vercel Serverless Function handler — re-exporta la Express app completa.
// Vercel enruta /api/* a esta función; el path llega como /api/auth/login, etc.
// Express monta las rutas sin el prefijo /api, así que lo stripamos aquí.

require('dotenv').config();
const app = require('../src/app');

// Middleware que elimina el prefijo /api antes de que Express procese la ruta.
// Sin esto, /api/auth/login no matchearía con app.use('/auth', authRoutes).
const handler = (req, res) => {
  // Vercel pasa la URL completa incluyendo /api
  if (req.url.startsWith('/api')) {
    req.url = req.url.slice(4) || '/';
  }
  return app(req, res);
};

module.exports = handler;
