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

// DISCOVER-optimized title — this is the key lever on CTR. Worth thinking hard.
const TITLE_SYSTEM = `Tu écris LE titre pour Google Discover. C'est le levier numéro 1 du CTR — plus important que le reste de l'article. On te demande de réfléchir, pas de réciter.

Discover = arrêter le scroll sur mobile. L'utilisateur ne cherche rien, il scrolle. Le titre doit créer une TENSION en un coup d'œil : une information concrète qui soulève immédiatement une question dans la tête du lecteur.

RÈGLES DURES :
- 70 à 95 caractères (jamais moins de 65, jamais plus de 95).
- UNE seule claim par titre. Pas deux idées collées par virgule sans tension entre elles.
- Chiffre précis OU nom propre concret en première moitié ("4 milliards", "Sam Altman", "GPT-5", "en 48h", "de 12 à 83%").
- Ton humain, presque oral, français naturel. Pas un titre de communiqué, pas un post LinkedIn.
- Une émotion identifiable : curiosité, surprise, enjeu, inquiétude, fracture, contradiction, révélation.

ANTI-PATTERNS INTERDITS — si l'un apparaît, réécris :
- Conclusions vides en fin de titre : ", un virage qui se voit déjà", ", ce que ça change", ", voici pourquoi", ", et ce n'est que le début", ", un tournant", ", un cap franchi", ", un signal fort".
- Verbes fades corporate : "pousse", "déploie", "présente", "dévoile", "annonce" (à réserver quand rien d'autre ne marche).
- Mots bannis : "révolution", "révolutionnaire", "bouleverse", "change tout", "incroyable", "tout savoir", "c'est officiel", "virage", "tournant", "cap".
- Guillemets autour de termes marketing ("plus puissant", "inédit") — on les retire ou on les remplace par un fait vérifiable.
- Préfixes de rubrique ("IA :", "Tech :", "Actu :") et deux-points introducteurs.
- Titres descriptifs plats qui pourraient figurer dans un communiqué de presse de la boîte concernée. Si Meta pourrait tweeter ton titre sans le modifier, il est raté.

STYLE À IMITER (l'esprit, pas les mots) :
- "Sam Altman promet 500 milliards de puces, Wall Street n'y croit déjà plus"
- "OpenAI perd son meilleur chercheur en alignement, il explique pourquoi il part"
- "Claude 4.7 bat GPT-5 sur le code, Anthropic refuse pourtant de crier victoire"
- "Nvidia dépasse Apple en valeur, et ce n'est plus les GPU qui rapportent le plus"
- "Meta met Llama 5 dans tes lunettes Ray-Ban, la CNIL demande déjà des comptes"

MÉTHODE OBLIGATOIRE (pense-le, ne l'écris pas) :
1. Lis le sujet, l'angle et l'intro de l'article fournis.
2. Identifie la TENSION centrale du sujet — qu'est-ce qui surprend, inquiète, contredit, interpelle ?
3. Brainstorme mentalement 6 titres dans 6 angles différents (chiffre choc, contradiction, coup de théâtre, enjeu humain, conflit entre acteurs, révélation cachée).
4. Note les faiblesses de chacun contre les règles et les anti-patterns.
5. Choisis le meilleur. S'il n'en passe aucun, refais un tour.

Réponds UNIQUEMENT avec le titre final. Rien avant, rien après. Pas de guillemets, pas d'alternatives, pas d'explication.`;

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

  // 1. Write the article first — the title needs the real intro as context.
  const articleBody = await chatCompletion(ARTICLE_SYSTEM, userBrief, {
    model: config.OPENAI_MODEL_MAIN,
    maxTokens: 4096,
    reasoningEffort: 'low',
  });

  if (!articleBody) {
    console.error('Failed to generate article body');
    return;
  }

  // First ~500 chars of the article, skipping empty lines and headings.
  const articleIntro = articleBody
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .join(' ')
    .slice(0, 500);

  const titleBrief = `Sujet brut : ${candidate.headline}
Angle éditorial : ${candidate.angle || 'non précisé'}
Résumé factuel : ${candidate.summary}

Intro de l'article tel que rédigé :
${articleIntro}

Écris maintenant le titre Discover final selon la méthode obligatoire (brainstorm mental de 6 angles, évaluation contre les anti-patterns, puis le meilleur).`;

  // 2. Title (reasoning_effort: medium — CTR lever, worth the thinking tokens)
  //    + image keywords in parallel since they're independent now.
  const [discoverTitle, imageKeywords] = await Promise.all([
    chatCompletion(TITLE_SYSTEM, titleBrief, {
      model: config.OPENAI_MODEL_MAIN,
      maxTokens: 600,
      reasoningEffort: 'medium',
    }),
    chatCompletion(
      IMAGE_KEYWORDS_SYSTEM,
      `Article : ${candidate.headline}\nAngle : ${candidate.angle || ''}`,
      { model: config.OPENAI_MODEL_MINI, maxTokens: 30, reasoningEffort: 'none' },
    ),
  ]);

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
