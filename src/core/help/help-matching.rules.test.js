const { tokenize, matchQuestionToArticle } = require('./help-matching.rules');

const ARTICLES = [
  {
    id: 'accounting-entry-balance',
    title: '¿Por qué no me deja guardar un asiento contable?',
    body: 'Un asiento contable siempre debe cuadrar: la suma de débitos debe ser igual a la suma de créditos.',
    moduleKeys: ['accounting'],
  },
  {
    id: 'treasury-reconciliation',
    title: '¿Qué es conciliar un movimiento bancario?',
    body: 'Es confirmar que un movimiento del extracto bancario corresponde a un asiento contable real.',
    moduleKeys: ['treasury'],
  },
];

describe('help-matching.rules', () => {
  test('tokenize quita tildes, minúsculas y palabras vacías', () => {
    expect(tokenize('¿Cómo concilio un movimiento?')).toEqual(['concilio', 'movimiento']);
  });

  test('matchQuestionToArticle encuentra el artículo correcto por palabras clave', () => {
    const result = matchQuestionToArticle('no puedo conciliar un movimiento bancario', ARTICLES);
    expect(result.id).toBe('treasury-reconciliation');
  });

  test('matchQuestionToArticle prioriza coincidencias en el título sobre el cuerpo', () => {
    const result = matchQuestionToArticle('por que no cuadra mi asiento contable', ARTICLES);
    expect(result.id).toBe('accounting-entry-balance');
  });

  test('matchQuestionToArticle no sugiere nada si no hay coincidencia suficiente (mejor no sugerir que sugerir mal)', () => {
    const result = matchQuestionToArticle('cuanto cuesta el pan', ARTICLES);
    expect(result).toBeNull();
  });

  test('matchQuestionToArticle devuelve null con una pregunta vacía', () => {
    expect(matchQuestionToArticle('', ARTICLES)).toBeNull();
    expect(matchQuestionToArticle('   ', ARTICLES)).toBeNull();
  });
});
