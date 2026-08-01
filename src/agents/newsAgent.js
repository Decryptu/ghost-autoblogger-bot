const { complete, completeJson } = require('../services/openai');
const { getRandomAuthor, resolveTags, publishPost } = require('../services/ghost');
const { searchAndPickImageForDiscover } = require('../services/unsplash');
const { discoverNews } = require('../services/newsDiscovery');
const { loadProcessedArticles, saveProcessedArticles, saveLocally } = require('../utils/storage');
const { markdownToHtml } = require('../utils/markdown');

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

// One call, two independent deliverables: the Discover title and the Unsplash
// keywords. Both read the same brief, so merging halves the input cost — but
// the prompt states explicitly that neither answer constrains the other.
const META_SYSTEM = `Tu produis DEUX livrables indépendants pour un article déjà rédigé : un titre Google Discover, et des mots-clés de recherche d'image. Chacun est jugé séparément, sur ses propres critères. La qualité de l'un ne doit jamais être sacrifiée pour l'autre.

=== LIVRABLE 1 — LE TITRE DISCOVER ===

C'est le levier numéro 1 du CTR — plus important que le reste de l'article. On te demande de réfléchir, pas de réciter.

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

TEST FINAL avant de répondre :
- Est-ce qu'il y a UNE tension claire (contradiction, chiffre choc, enjeu humain) ?
- Est-ce que le titre pourrait apparaître tel quel sur le compte Twitter de la boîte concernée ? Si oui, c'est raté — rends-le plus tranchant.
- Y a-t-il un seul mot interdit ou anti-pattern ? Si oui, réécris.
- Entre 70 et 95 caractères ?

=== LIVRABLE 2 — LES MOTS-CLÉS IMAGE ===

Mots-clés pour chercher sur Unsplash une image qui arrête le scroll dans un feed mobile.
- 2 à 4 mots-clés en anglais, séparés par des espaces.
- Cherche du visage humain, de l'expression, une scène concrète, un gros plan, une atmosphère forte.
- Interdit : "illustration", "concept", "abstract", "generic", "stock", "futuristic".
- Si le sujet concerne une personne nommée, décris son rôle/contexte ("CEO speaking stage", "engineer dark office screen").
- Si le sujet est un drama/conflit/régulation, vise "courtroom", "protest", "board meeting tense", "contract signing".
- Ils décrivent le SUJET de l'article, pas la formulation du titre.`;

const META_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Le titre Discover final, sans guillemets' },
    imageKeywords: {
      type: 'string',
      description: '2 à 4 mots-clés anglais séparés par des espaces',
    },
  },
  required: ['title', 'imageKeywords'],
  additionalProperties: false,
};

/**
 * Run the news article pipeline.
 * 1. Discover fresh AI-news candidates via web search.
 * 2. Pick the first unseen one and write the article.
 * 3. Derive the Discover title + image keywords from the finished article.
 * 4. Pick the most scroll-stopping image, publish to Ghost.
 */
async function runNewsAgent() {
  console.log('\n=== News Agent: Starting ===');

  const processedArticles = await loadProcessedArticles();

  console.log('Discovering news candidates via AI web search...');
  const candidates = await discoverNews([...processedArticles]);

  const fresh = candidates.filter(c => !processedArticles.has(c.headline));
  if (fresh.length === 0) {
    console.log(`No fresh candidate (${candidates.length} returned). Exiting.`);
    return;
  }

  const candidate = fresh[0];
  processedArticles.add(candidate.headline);
  await saveProcessedArticles(processedArticles);

  console.log(`Processing: ${candidate.headline}`);
  console.log(`Angle: ${candidate.angle}`);

  const sourcesLine =
    Array.isArray(candidate.sources) && candidate.sources.length > 0
      ? `\n\nSources repérées : ${candidate.sources.join(', ')}`
      : '';

  const brief = `Sujet : ${candidate.headline}

Angle éditorial : ${candidate.angle || 'non précisé'}

Faits à couvrir : ${candidate.summary}${sourcesLine}`;

  // Article first — the title needs the real intro as context.
  const articleBody = await complete('article', {
    instructions: ARTICLE_SYSTEM,
    input: `${brief}\n\nRédige l'article en markdown brut, 600-1200 mots, selon les règles système.`,
  });

  // First ~500 chars of the article, skipping empty lines and headings.
  const articleIntro = articleBody
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .join(' ')
    .slice(0, 500);

  const meta = await completeJson('articleMeta', {
    instructions: META_SYSTEM,
    schema: META_SCHEMA,
    input: `${brief}

Intro de l'article tel que rédigé :
${articleIntro}

Produis le titre Discover final et les mots-clés image.`,
  });

  const title = meta.title.trim();
  const imageKeywords = meta.imageKeywords.trim();
  console.log(`Title (${title.length} chars): ${title}`);
  console.log(`Image keywords: ${imageKeywords}`);

  const [imageUrl, tags, author] = await Promise.all([
    searchAndPickImageForDiscover(imageKeywords, title),
    resolveTags(NEWS_TAGS),
    getRandomAuthor(),
  ]);

  await saveLocally(title, articleBody, imageUrl, NEWS_TAGS);

  await publishPost({
    title,
    html: markdownToHtml(articleBody),
    featureImage: imageUrl,
    tags,
    authorId: author.id,
  });

  console.log(`=== News Agent: Done (author: ${author.name}) ===\n`);
}

module.exports = { runNewsAgent };
