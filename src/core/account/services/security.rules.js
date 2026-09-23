// Función pura: fortaleza de una contraseña nueva (Mi Cuenta, punto 2).
// Mínimo 8 caracteres, al menos una mayúscula, una minúscula y un
// número — reglas simples y explicables, no un medidor de entropía.
function assertStrongPassword(password) {
  const problems = [];
  if (!password || password.length < 8) problems.push('al menos 8 caracteres');
  if (!/[a-z]/.test(password || '')) problems.push('una letra minúscula');
  if (!/[A-Z]/.test(password || '')) problems.push('una letra mayúscula');
  if (!/[0-9]/.test(password || '')) problems.push('un número');
  return problems;
}

function isStrongPassword(password) {
  return assertStrongPassword(password).length === 0;
}

module.exports = { assertStrongPassword, isStrongPassword };
