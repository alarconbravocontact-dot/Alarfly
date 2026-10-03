const asyncHandler = require('../utils/asyncHandler');
const contactService = require('./contact.service');

const createContactMessage = asyncHandler(async (req, res) => {
  const result = await contactService.createContactMessage(req.body, req.ip);
  // Mismo mensaje de éxito tanto si se guardó como si se descartó por
  // honeypot (`result === null`) — nunca se le avisa a un bot que fue
  // detectado, ver contact.service.js.
  res.status(201).json({ received: true, id: result ? result.id : null });
});

module.exports = { createContactMessage };
