const { chatCompletion } = require('../services/openai');
const { getRandomAuthor, resolveTags, publishPost } = require('../services/ghost');
const { searchAndPickImageForDiscover } = require('../services/unsplash');
const { discoverNews } = require('../services/newsDiscovery');
const { loadProcessedArticles, saveProcessedArticles, saveLocally } = require('../utils/storage');
const { markdownToHtml } = require('../utils/markdown');
const config = require('../config');

const NEWS_TAGS = ['actualite', 'technologie', 'intelligence-artificielle'];

const ARTICLE_SYSTEM = `Tu es journaliste senior spécialisé IA pour Pandia, média tech français. Tu écris des articles d'actualité percutants, factuels, richement analysés.

Règles strictes :
- Français impeccable, ton journalistique professionnel (pas corporate, pas hypé).
- NE PAS inclure de titre H1 (le titre est géré séparément).
- Ouvrir par une accroche qui capte immédiatement l'attention en 1-2 phrases (pas de "aujourd'hui", pas de "récemment").
- Structure avec des H2 (##) et H3 (###) qui racontent l'histoire, pas qui listent des rubriques.
- Gras (**texte**) pour les chiffres et noms clés, italique (*texte*) pour les termes techniques.
- NE JAMAIS utiliser "nous", "je", "révolution", "révolutionnaire", "bouleverse", "change la donne".
- 600 à 1200 mots.
- Chiffres précis, dates, noms propres, citations courtes si pertinent.
- Apporter du contexte et de l'analyse, pas reformuler platement l'info.
- Terminer par une mise en perspective concrète (conséquences mesurables, prochain jalon attendu).
- Format markdown brut, aucun bloc de code.`;

// DISCOVER-optimized title — this is the key lever on CTR
const TITLE_SYSTEM = `Tu écris des titres pour Google Discover, PAS pour Google Search.

Discover = arrêter le scroll sur mobile. L'utilisateur ne cherche rien, il scrolle. Le titre doit créer une émotion + une promesse en un coup d'œil.

RÈGLES STRICTES :
- Entre 70 et 95 caractères (hors quelques rares exceptions, jamais en dessous de 60).
- Une émotion (curiosité, surprise, enjeu, inquiétude, fascination, fracture) + une promesse concrète.
- Phrase française naturelle, ton humain, presque oral — pas un titre de communiqué.
- Chiffres précis quand disponibles ("4 milliards", "en 48h", "de 12 à 83%").
- Noms propres concrets (OpenAI, Sam Altman, Claude, Mistral, GPT-5).
- ZÉRO mot générique interdit : "révolution", "incroyable", "bouleverse", "change tout", "voici pourquoi", "tout savoir", "c'est officiel".
- Pas de clickbait : la promesse doit être tenue par l'article (pas de "vous n'allez pas croire").
- Pas de préfixes de rubrique ("IA :", "Tech :", "Actu :"), pas de deux-points introducteurs.

STYLE À IMITER (l'esprit, pas les mots) :
- "Sam Altman promet 500 milliards de puces, Wall Street n'y croit déjà plus"
- "OpenAI vient de perdre son meilleur chercheur en alignement, voici ce qu'il dénonce"
- "Claude 4.7 bat GPT-5 sur le code, mais Anthropic refuse de crier victoire"
- "Nvidia dépasse Apple en valeur, et ce n'est plus les GPU qui font la différence"

Réponds UNIQUEMENT avec le titre. Rien avant, rien après, pas de guillemets.`;

// DISCOVER image keywords — bias toward faces, emotion, concrete scenes
const IMAGE_KEYWORDS_SYSTEM = `Tu génères des mots-clés pour chercher une image sur Unsplash qui arrête le scroll dans un feed mobile Google Discover.

Règles :
- 2 à 4 mots-clés en anglais séparés par des espaces.
- Cherche du visage humain, de l'expression, une scène concrète, un gros plan, une atmosphère forte.
- Interdit : "illustration", "concept", "abstract", "generic", "stock", "futuristic".
- Si le sujet concerne une personne nommée, décris son rôle/contexte (ex: "CEO speaking stage", "engineer dark office screen").
- Si le sujet est un drama/conflit/régulation, vise "courtroom", "protest", "board meeting tense", "contract signing".

Réponds UNIQUEMENT avec les mots-clés. Pas de phrase.`;

/**
 * Run the news article pipeline.
 * 1. Discover fresh AI-news candidates via web search.
 * 2. Pick the first unseen one.
 * 3. Generate a Discover-optimized title, emotional image keywords, and the article body.
 * 4. Pick the most scroll-stopping image, publish to Ghost.
 */
async function runNewsAgent() {
  console.log('\n=== News Agent: Starting ===');

  const processedArticles = await loadProcessedArticles();

  console.log('Discovering news candidates via AI web search...');
  const candidates = await discoverNews([...processedArticles]);

  if (candidates.length === 0) {
    console.log('No candidates surfaced this run. Exiting.');
    return;
  }
  console.log(`Discovery returned ${candidates.length} candidate(s)`);

  const fresh = candidates.filter(c => !processedArticles.has(c.headline));
  if (fresh.length === 0) {
    console.log('All candidates already processed. Exiting.');
    return;
  }

  const candidate = fresh[0];
  processedArticles.add(candidate.headline);
  await saveProcessedArticles(processedArticles);

  console.log(`Processing: ${candidate.headline}`);
  console.log(`Angle: ${candidate.angle}`);

  const sourcesLine = Array.isArray(candidate.sources) && candidate.sources.length > 0
    ? `\n\nSources repérées : ${candidate.sources.join(', ')}`
    : '';

  const userBrief = `Sujet : ${candidate.headline}

Angle éditorial : ${candidate.angle || 'non précisé'}

Faits à couvrir : ${candidate.summary}${sourcesLine}

Rédige l'article en markdown brut, 600-1200 mots, selon les règles système.`;

  const [articleBody, discoverTitle, imageKeywords] = await Promise.all([
    chatCompletion(ARTICLE_SYSTEM, userBrief, {
      model: config.OPENAI_MODEL_MAIN,
      maxTokens: 4096,
      reasoningEffort: 'low',
    }),
    chatCompletion(
      TITLE_SYSTEM,
      `Sujet : ${candidate.headline}\nAngle : ${candidate.angle || 'non précisé'}\nContexte : ${candidate.summary}\n\nÉcris le titre Discover (70-95 caractères, émotion + promesse).`,
      { model: config.OPENAI_MODEL_MAIN, maxTokens: 120, reasoningEffort: 'none' },
    ),
    chatCompletion(
      IMAGE_KEYWORDS_SYSTEM,
      `Article : ${candidate.headline}\nAngle : ${candidate.angle || ''}`,
      { model: config.OPENAI_MODEL_MINI, maxTokens: 30, reasoningEffort: 'none' },
    ),
  ]);

  if (!articleBody) {
    console.error('Failed to generate article body');
    return;
  }

  console.log(`Title: ${discoverTitle}`);
  console.log(`Image keywords: ${imageKeywords}`);

  const [imageUrl, tags, author] = await Promise.all([
    searchAndPickImageForDiscover(imageKeywords, discoverTitle),
    resolveTags(NEWS_TAGS),
    getRandomAuthor(),
  ]);

  await saveLocally(discoverTitle, articleBody, imageUrl, NEWS_TAGS);

  const html = markdownToHtml(articleBody);
  await publishPost({
    title: discoverTitle,
    html,
    featureImage: imageUrl,
    tags,
    authorId: author.id,
  });

  console.log(`=== News Agent: Done (author: ${author.name}) ===\n`);
}

module.exports = { runNewsAgent };
