// Función pura: empareja el texto de una pregunta contra el catálogo
// de artículos de ayuda por palabras clave compartidas — NUNCA con
// IA/LLM (el proyecto no integra ninguno en ningún otro lugar). Mismo
// criterio de "mejor no sugerir que sugerir mal" ya usado en la
// detección de recurrencia de AR y en la detección de anomalías de la
// línea de tiempo: si el mejor puntaje no llega al mínimo, no sugiere
// nada en vez de forzar una coincidencia mala.
const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'a', 'en', 'y', 'o',
  'que', 'con', 'por', 'para', 'es', 'se', 'no', 'me', 'mi', 'su', 'sus', 'lo', 'le', 'les',
  'como', 'cómo', 'qué', 'cual', 'cuál', 'donde', 'dónde', 'cuando', 'cuándo', 'porque', 'porqué',
  'este', 'esta', 'esto', 'ese', 'esa', 'eso', 'sin', 'más', 'muy', 'ya', 'si', 'sí',
]);

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos (marcas diacríticas tras NFD)
    .replace(/[^a-z0-9\s]/g, ' ');
}

function tokenize(text) {
  return normalize(text)
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

// Puntaje de un artículo contra una pregunta: cuántas palabras clave
// significativas de la pregunta aparecen en el título o el cuerpo del
// artículo, con el título valiendo el doble (una coincidencia en el
// título es más significativa que una perdida en el cuerpo).
function scoreArticle(questionWords, article) {
  const titleWords = new Set(tokenize(article.title));
  const bodyWords = new Set(tokenize(article.body));
  let score = 0;
  for (const word of questionWords) {
    if (titleWords.has(word)) score += 2;
    else if (bodyWords.has(word)) score += 1;
  }
  return score;
}

const MIN_SCORE = 2;

function matchQuestionToArticle(questionText, articles) {
  const questionWords = tokenize(questionText);
  if (questionWords.length === 0) return null;

  let best = null;
  let bestScore = 0;
  for (const article of articles) {
    const score = scoreArticle(questionWords, article);
    if (score > bestScore) {
      bestScore = score;
      best = article;
    }
  }
  return bestScore >= MIN_SCORE ? best : null;
}

module.exports = { tokenize, scoreArticle, matchQuestionToArticle, MIN_SCORE };
