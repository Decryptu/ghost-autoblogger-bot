const { complete } = require('./openai');
const { extractJsonArray } = require('../utils/json');

// Stable prefix — never interpolate anything volatile in here, it is the part
// prompt caching can reuse across runs.
const DISCOVERY_INSTRUCTIONS = `Tu es veilleur senior pour Pandia, média tech français spécialisé en IA.

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
- Rejette les sujets proches de ceux déjà publiés qui te seront fournis.
- Chaque candidat doit être vérifiable : au moins une source solide.

SORTIE — UNIQUEMENT un tableau json (aucun préambule, aucun commentaire, aucun code fence) :
[
  {
    "headline": "Phrase factuelle en français résumant l'événement",
    "angle": "1 phrase : l'angle émotionnel (curiosité, surprise, enjeu, controverse) qui fait arrêter le scroll",
    "summary": "3-5 phrases factuelles : chiffres exacts, noms propres, dates, mécanismes. C'est le brief du rédacteur, sois précis.",
    "sources": ["url1", "url2"]
  }
]

3 à 5 candidats max. Si rien n'atteint le niveau Discover, renvoie [].`;

/**
 * Discover AI-news candidates worth publishing, using web search.
 * Returns up to 5 candidates ranked by Discover-potential.
 */
async function discoverNews(recentTitles = []) {
  const todayIso = new Date().toISOString().slice(0, 10);

  // Referenced by their own text, never by position: a numbered list renumbers
  // whenever an entry ages out, rewriting the block from its first byte.
  const exclusions = recentTitles.slice(-40);
  const exclusionBlock = exclusions.length
    ? `\n\nSUJETS DÉJÀ PUBLIÉS (à éviter — même sujet ou très proche) :\n${exclusions.map(t => `- ${t}`).join('\n')}`
    : '';

  const raw = await complete('newsDiscovery', {
    instructions: DISCOVERY_INSTRUCTIONS,
    input: `Date du jour : ${todayIso}.${exclusionBlock}\n\nLance la veille et renvoie le tableau json des candidats.`,
  });

  return extractJsonArray(raw).filter(c => c?.headline && c?.summary);
}

module.exports = { discoverNews };
