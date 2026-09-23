// Validadores de campo con mensaje específico y accionable (Feature T)
// — nunca "Campo inválido": cada uno explica exactamente qué formato
// se espera. Cuando el error tiene una causa común conocida (ej. pegar
// un número con puntos de miles), devuelven `autoFix` con el valor ya
// corregido — la pantalla decide si ofrecer el botón "Corregir
// automáticamente" con ese valor.

const RIF_PATTERN = /^[VEJPGvejpg]-\d{8}-\d$/;

// RIF venezolano: letra-8dígitos-dígito verificador (ej. J-12345678-9).
// Causa común conocida: el usuario pegó el número con puntos de miles
// (ej. "J-12.345.678-9", como se ve en otros sistemas) — se detecta y
// se ofrece quitar los puntos en vez de solo rechazar.
export function validateRif(value) {
  const trimmed = (value || '').trim();
  if (trimmed === '') return { valid: true };
  if (RIF_PATTERN.test(trimmed)) return { valid: true };

  const withoutDots = trimmed.replace(/\./g, '');
  if (RIF_PATTERN.test(withoutDots)) {
    return { valid: false, message: 'El RIF debe tener el formato J-12345678-9.', autoFix: withoutDots.toUpperCase() };
  }

  return { valid: false, message: 'El RIF debe tener el formato J-12345678-9 (una letra, guion, 8 dígitos, guion, dígito verificador).' };
}

// Monto en texto libre (campos que aceptan un número pero no son un
// <input type="number">, ej. límite de crédito). Causa común conocida:
// el usuario pegó el monto con puntos y/o comas de miles (ej.
// "15.000,00" o "15,000.00") — se detecta y se ofrece normalizar a un
// número plano con punto decimal.
export function validateThousandsAmount(value) {
  const trimmed = (value || '').trim();
  if (trimmed === '') return { valid: true };
  if (/^\d+(\.\d+)?$/.test(trimmed)) return { valid: true };

  // Formato "15.000,00" (miles con punto, decimal con coma) o "15,000.00"
  // (miles con coma, decimal con punto) — nunca ambos separadores del
  // mismo tipo repetidos sin el otro, para no adivinar mal un caso
  // ambiguo como "15.000" (¿miles o decimal?).
  const latin = /^\d{1,3}(\.\d{3})+(,\d+)?$/;
  const us = /^\d{1,3}(,\d{3})+(\.\d+)?$/;
  if (latin.test(trimmed)) {
    return { valid: false, message: 'Escribe el monto sin puntos de miles (ej. 15000.00).', autoFix: trimmed.replace(/\./g, '').replace(',', '.') };
  }
  if (us.test(trimmed)) {
    return { valid: false, message: 'Escribe el monto sin comas de miles (ej. 15000.00).', autoFix: trimmed.replace(/,/g, '') };
  }

  return { valid: false, message: 'El monto debe ser un número (ej. 15000 o 15000.50).' };
}
