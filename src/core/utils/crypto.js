// Cifrado simétrico para datos sensibles en reposo (hoy solo el
// secreto TOTP de 2FA, ver core/account/security.service.js). AES-256-GCM
// con Node nativo — no se agrega ninguna dependencia nueva para esto.
// La llave se deriva del JWT_SECRET ya existente (no se pide una
// variable de entorno nueva: JWT_SECRET ya es un secreto propio de
// cada despliegue) con un sufijo distinto, para no reutilizar la
// misma llave cruda que firma los tokens.
const crypto = require('crypto');
const config = require('../config');

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  return crypto.createHash('sha256').update(`${config.jwtSecret}:2fa-secret`).digest();
}

function encrypt(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

function decrypt(encryptedText) {
  const [ivHex, authTagHex, dataHex] = encryptedText.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
