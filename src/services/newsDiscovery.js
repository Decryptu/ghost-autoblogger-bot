const { webSearchCompletion } = require('./openai');
const config = require('../config');

/**
 * Strip markdown fences and locate the first balanced JSON array in a string.
 */
function extractJsonArray(text) {
  let trimmed = (text || '').trim();
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  const start = trimmed.indexOf('[');
  if (start === -1) return [];

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(trimmed.slice(start, i + 1));
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
    }
  }
  return [];
}

/**
 * Discover AI-news candidates worth publishing, using an AI agent with web search.
 * Returns up to 5 candidates ranked by Discover-potential (scroll-stopping value).
 */
async function discoverNews(recentTitles = []) {
  const todayIso = new Date().toISOString().slice(0, 10);

  const exclusionBlock = recentTitles.length
    ? `\n\nSUJETS DÉJÀ PUBLIÉS (à éviter — même sujet ou très proche) :\n${recentTitles.slice(-40).map((t, i) => `${i + 1}. ${t}`).join('\n')}`
    : '';

  const prompt = `Tu es veilleur senior pour Pandia, média tech français spécialisé en IA. Date : ${todayIso}.

Tu utilises web_search de manière AGRESSIVE pour repérer les sujets d'actu IA qui peuvent cartonner AUJOURD'HUI sur Google Discover — pas sur Google Search.

RAPPEL — Discover, pas SEO :
- L'utilisateur ne cherche rien : il scrolle son feed mobile.
- Il faut des histoires qui arrêtent le scroll : annonce marquante, coup de théâtre, chiffre choc, controverse, départ d'une figure clé, benchmark surprenant, drama entre labos, révélation.
- Pas de news tièdes. Pas de liste de features. Pas de reprise de communiqué de presse.

WORKFLOW (au moins 5 recherches web distinctes, angles différents) :
1. Annonces récentes des grands labos (OpenAI, Anthropic, Google DeepMind, Meta AI, xAI, Mistral, Nvidia, Microsoft, Apple Intelligence).
2. Nouveaux modèles / benchmarks / évaluations publiés cette semaine.
3. Drama / départs / conflits / régulation / procès en cours.
4. Chiffres marquants (revenus, valorisations, levées, adoption, marché publicitaire, impact emploi).
5. Une recherche libre sur un signal que tu as vu émerger dans les recherches précédentes.

FILTRE DE PERTINENCE — appliquer strictement :
- L'histoire doit avoir du relief pour un lecteur francophone qui scrolle : un nom connu, un chiffre tangible, un enjeu concret.
- Préfère qualité à quantité : si rien ne sort du lot, renvoie moins (voire []).
- Rejette les simples tweets, rumeurs non sourcées, posts de blog obscurs, contenus sponsorisés.
- Rejette les sujets déjà couverts (voir liste ci-dessous).

Chaque candidat doit être vérifiable : au moins une source solide.${exclusionBlock}

SORTIE — UNIQUEMENT un tableau JSON (aucun préambule, aucun commentaire, aucun code fence) :
[
  {
    "headline": "Phrase factuelle en français résumant l'événement",
    "angle": "1 phrase : l'angle émotionnel (curiosité, surprise, enjeu, controverse) qui fait arrêter le scroll",
    "summary": "3-5 phrases factuelles : chiffres exacts, noms propres, dates, mécanismes. C'est le brief du rédacteur, sois précis.",
    "sources": ["url1", "url2"]
  }
]

3 à 5 candidats max. Si rien n'atteint le niveau Discover, renvoie [].`;

  const raw = await webSearchCompletion(prompt, {
    model: config.OPENAI_MODEL_MINI,
    maxTokens: 12000,
    reasoningEffort: 'low',
  });

  const candidates = extractJsonArray(raw);
  return candidates.filter(c => c && c.headline && c.summary);
}

module.exports = { discoverNews };
