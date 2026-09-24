const { complete, completeJson } = require('../services/openai');
const {
  getRandomAuthor,
  resolveTags,
  publishPost,
  fetchPostTitlesByTag,
} = require('../services/ghost');
const { searchImage } = require('../services/unsplash');
const { saveLocally } = require('../utils/storage');
const { markdownToHtml } = require('../utils/markdown');

const GUIDE_TAGS = ['guide', 'intelligence-artificielle'];

const TOPIC_SYSTEM = `Tu es rédacteur en chef SEO de Pandia, média tech français sur l'IA. Tu produis DEUX livrables indépendants : le sujet du guide à publier aujourd'hui, et les mots-clés de recherche d'image qui l'illustreront. Chacun est jugé sur ses propres critères.

=== LIVRABLE 1 — LE SUJET ===

Les guides sont du contenu FROID (evergreen), conçus pour capter du trafic Google Search sur des requêtes à forte intention. Ce n'est PAS pour Discover, pas pour les réseaux sociaux.

CATÉGORIES POSSIBLES :
- Comment acheter des actions d'entreprises IA (OpenAI, Anthropic, Google, NVIDIA, Meta, Microsoft, etc.)
- Comment utiliser un outil IA (ChatGPT, Claude, Midjourney, Stable Diffusion, Copilot, etc.)
- Guides pratiques (créer un chatbot, automatiser avec l'IA, etc.)
- Comprendre l'IA (LLM, transformers, RAG, fine-tuning, etc.)
- IA et métiers (marketing, droit, santé, éducation, etc.)
- Comparatifs ("ChatGPT vs Claude", "meilleurs outils IA pour X")
- Tutoriels techniques (fine-tuning, RAG, prompt engineering, etc.)

RÈGLES DE TITRE SEO :
- Commence par le mot-clé d'intention ("Comment", "Guide", "Les meilleurs", "Comprendre", "X vs Y").
- 50-65 caractères idéalement.
- Exprime clairement la requête qu'un internaute tape sur Google.
- Pas d'émotion / pas de hook Discover — c'est un titre de recherche froide.
- Spécifique, pas générique : "Comment utiliser ChatGPT pour rédiger un CV en 2026" plutôt que "Guide ChatGPT".
- Pas de guillemets, pas de préfixes de rubrique.
- Le sujet doit être différent de tous les guides déjà publiés qui te seront fournis.

=== LIVRABLE 2 — LES MOTS-CLÉS IMAGE ===

2 à 4 mots-clés en anglais, séparés par des espaces, pour trouver sur Unsplash une illustration propre et professionnelle : claire, soignée, pertinente — pas émotionnelle ni sensationnelle.`;

const TOPIC_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Le titre du guide en français' },
    imageKeywords: {
      type: 'string',
      description: '2 à 4 mots-clés anglais séparés par des espaces',
    },
  },
  required: ['title', 'imageKeywords'],
  additionalProperties: false,
};

const GUIDE_SYSTEM = `Tu es rédacteur SEO expert pour Pandia, média tech français sur l'IA. Tu écris des guides pratiques approfondis, clairs, utiles, optimisés pour le référencement Google Search.

Règles strictes :
- Français impeccable, ton pédagogique et professionnel.
- NE PAS inclure de titre H1 (géré séparément).
- Introduction qui place les mots-clés principaux dans les 2 premières phrases et annonce ce que le lecteur va apprendre.
- Structure avec H2 (##) et H3 (###) qui couvrent les intentions de recherche secondaires ("Qu'est-ce que", "Pourquoi", "Comment", "Combien", "Quand").
- Étapes numérotées quand c'est pertinent (listes ordonnées).
- Gras (**texte**) pour les points clés.
- Minimum 1000 mots, idéalement 1500-2000.
- Factuel, précis, à jour, vérifiable. Chiffres et dates quand possible.
- Conseils pratiques concrets + mises en garde honnêtes.
- Conclusion avec récapitulatif des points clés à retenir.
- NE JAMAIS utiliser "nous", "je", "révolution".
- Format markdown brut, aucun bloc de code.`;

async function runGuideAgent() {
  console.log('\n=== Guide Agent: Starting ===');

  const existingTitles = await fetchPostTitlesByTag('guide');
  console.log(`Found ${existingTitles.length} existing guides in Ghost`);

  // Never numbered: renumbering on each new guide would break the prompt cache prefix.
  const dedupContext = existingTitles.length
    ? `\n\nGUIDES DÉJÀ PUBLIÉS (choisis un sujet DIFFÉRENT de tous ceux-ci) :\n${existingTitles.map(t => `- ${t}`).join('\n')}`
    : '';

  const topicMeta = await completeJson('guideTopic', {
    instructions: TOPIC_SYSTEM,
    schema: TOPIC_SCHEMA,
    input: `Choisis un sujet de guide SEO sur l'IA à publier aujourd'hui, et ses mots-clés image.${dedupContext}`,
  });

  const topic = topicMeta.title.trim();
  const imageKeywords = topicMeta.imageKeywords.trim();
  console.log(`Guide topic: ${topic}`);
  console.log(`Image keywords: ${imageKeywords}`);

  const guideContent = await complete('guide', {
    instructions: GUIDE_SYSTEM,
    input: `Écris un guide SEO complet et détaillé sur le sujet suivant :\n\n"${topic}"\n\nLe guide doit être exhaustif, pratique, optimisé pour Google Search et utile pour un lecteur francophone. Format markdown brut.`,
  });

  const [imageUrl, tags, author] = await Promise.all([
    searchImage(imageKeywords),
    resolveTags(GUIDE_TAGS),
    getRandomAuthor(),
  ]);

  await saveLocally(topic, guideContent, imageUrl, GUIDE_TAGS);

  await publishPost({
    title: topic,
    html: markdownToHtml(guideContent),
    featureImage: imageUrl,
    tags,
    authorId: author.id,
  });

  console.log(`=== Guide Agent: Done (author: ${author.name}) ===\n`);
}

module.exports = { runGuideAgent };
