const prisma = require('../database/prisma');
const { listArticles, findArticleById, HELP_ARTICLES } = require('./help-catalog');
const { matchQuestionToArticle } = require('./help-matching.rules');

async function getContext(companyId, userId, moduleKey) {
  const articles = listArticles(moduleKey);

  // La innovación pedida: si este usuario ya preguntó algo antes cuyo
  // artículo emparejado también aplica a este mismo módulo, se lo
  // devolvemos aparte para que el frontend lo muestre primero — antes
  // de la lista genérica de artículos.
  const priorQuestions = await prisma.supportQuestion.findMany({
    where: { companyId, userId, matchedArticleId: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const priorMatch = priorQuestions
    .map((q) => ({ question: q, article: findArticleById(q.matchedArticleId) }))
    .find(({ article }) => article && article.moduleKeys.includes(moduleKey));

  return {
    articles,
    priorAnswer: priorMatch
      ? { questionText: priorMatch.question.questionText, askedAt: priorMatch.question.createdAt, article: priorMatch.article }
      : null,
  };
}

async function askQuestion(companyId, userId, moduleKey, questionText) {
  const matched = matchQuestionToArticle(questionText, HELP_ARTICLES);
  await prisma.supportQuestion.create({
    data: { companyId, userId, moduleKey, questionText, matchedArticleId: matched ? matched.id : null },
  });
  return { article: matched };
}

module.exports = { getContext, askQuestion };
