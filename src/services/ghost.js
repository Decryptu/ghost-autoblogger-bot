const GhostAdminAPI = require('@tryghost/admin-api');
const { memo } = require('../utils/cache');
const { GHOST_CACHE_TTL_MS } = require('../config');
const { requireEnv } = require('../utils/env');

let ghost;

function getClient() {
  if (!ghost) {
    ghost = new GhostAdminAPI({
      url: requireEnv('GHOST_API_URL'),
      key: requireEnv('GHOST_ADMIN_API_KEY'),
      version: 'v5.0',
    });
  }
  return ghost;
}

const fetchAuthors = memo(async () => {
  try {
    const users = await getClient().users.browse({ limit: 'all' });
    const authors = users.map(u => ({ id: u.id, name: u.name, slug: u.slug }));
    console.log(`Loaded ${authors.length} Ghost authors: ${authors.map(a => a.name).join(', ')}`);
    return authors;
  } catch (error) {
    console.error('Error fetching Ghost authors:', error.message);
    return [{ id: '1', name: 'Default', slug: 'default' }];
  }
}, GHOST_CACHE_TTL_MS);

const fetchTags = memo(() => getClient().tags.browse({ limit: 'all' }), GHOST_CACHE_TTL_MS);

async function getRandomAuthor() {
  const authors = await fetchAuthors();
  return authors[Math.floor(Math.random() * authors.length)];
}

async function resolveTags(tagNames) {
  const existingTags = await fetchTags();
  return tagNames.map(name => {
    const existing = existingTags.find(t => t.name === name || t.slug === name);
    return existing ? { id: existing.id } : { name };
  });
}

async function publishPost({ title, html, featureImage, tags, authorId }) {
  const post = await getClient().posts.add(
    {
      title,
      html,
      feature_image: featureImage,
      status: 'published',
      tags,
      authors: [{ id: authorId }],
    },
    { source: 'html' },
  );

  console.log(`Published to Ghost: ${post.url} (author: ${authorId})`);
  return post;
}

const fetchPostTitlesByTag = memo(async tagSlug => {
  const client = getClient();
  const titles = [];
  const limit = 100;

  for (let page = 1; ; page++) {
    const posts = await client.posts.browse({
      filter: `tag:${tagSlug}`,
      fields: 'title',
      limit,
      page,
    });

    for (const post of posts) titles.push(post.title);
    if (posts.length < limit) break;
  }

  return titles;
}, GHOST_CACHE_TTL_MS);

module.exports = {
  getClient,
  fetchAuthors,
  getRandomAuthor,
  resolveTags,
  publishPost,
  fetchPostTitlesByTag,
};
