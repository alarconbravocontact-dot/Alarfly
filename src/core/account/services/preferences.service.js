// Mi Cuenta, punto 6: preferencias de visualización. Fila 1 a 1 con el
// usuario; se crea con los valores por defecto la primera vez que se
// consulta, para no tener que sembrar una fila vacía por cada usuario
// que ya existía antes de este módulo.
//
// Selector unificado de idioma/huso horario/formato regional (Feature
// U): language/dateFormat/timeZone son nullable a nivel de usuario —
// `null` significa "usar el valor por defecto de la empresa"
// (Company.defaultLanguage/defaultDateFormat/defaultTimeZone). El
// ajuste del usuario tiene prioridad sobre el de la empresa solo
// cuando el usuario elige un valor propio explícito.
const prisma = require('../../database/prisma');

async function getPreferences(userId, companyId) {
  const [existing, company] = await Promise.all([
    prisma.userPreference.findUnique({ where: { userId } }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { defaultLanguage: true, defaultDateFormat: true, defaultTimeZone: true },
    }),
  ]);
  const raw = existing || (await prisma.userPreference.create({ data: { userId } }));

  return {
    ...raw,
    companyDefaults: company,
    effectiveLanguage: raw.language ?? company?.defaultLanguage ?? 'es',
    effectiveDateFormat: raw.dateFormat ?? company?.defaultDateFormat ?? 'DD/MM/YYYY',
    effectiveTimeZone: raw.timeZone ?? company?.defaultTimeZone ?? null,
  };
}

async function updatePreferences(
  userId,
  { displayCurrency, dateFormat, decimalSeparator, language, timeZone, theme, autoIncognitoOnScreenShare, beginnerIconLabels }
) {
  return prisma.userPreference.upsert({
    where: { userId },
    update: { displayCurrency, dateFormat, decimalSeparator, language, timeZone, theme, autoIncognitoOnScreenShare, beginnerIconLabels },
    create: {
      userId,
      displayCurrency,
      dateFormat,
      decimalSeparator,
      language,
      timeZone,
      theme,
      autoIncognitoOnScreenShare,
      beginnerIconLabels,
    },
  });
}

module.exports = { getPreferences, updatePreferences };
