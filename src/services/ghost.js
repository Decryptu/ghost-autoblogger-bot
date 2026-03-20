const GhostAdminAPI = require('@tryghost/admin-api');

let ghost = null;
let cachedAuthors = null;

function getClient() {
  if (!ghost) {
    ghost = new GhostAdminAPI({
      url: process.env.GHOST_API_URL,
      key: process.env.GHOST_ADMIN_API_KEY,
      version: 'v5.0',
    });
  }
  return ghost;
}

/**
 * Fetch all staff authors from Ghost and cache them.
 */
async function fetchAuthors() {
  if (cachedAuthors) return cachedAuthors;

  try {
    const client = getClient();
    const users = await client.users.browse({ limit: 'all' });
    cachedAuthors = users.map(u => ({ id: u.id, name: u.name, slug: u.slug }));
    console.log(`Loaded ${cachedAuthors.length} Ghost authors:`, cachedAuthors.map(a => a.name).join(', '));
    return cachedAuthors;
  } catch (error) {
    console.error('Error fetching Ghost authors:', error.message);
    return [{ id: '1', name: 'Default', slug: 'default' }];
  }
}

/**
 * Pick a random author from the staff list.
 */
async function getRandomAuthor() {
  const authors = await fetchAuthors();
  return authors[Math.floor(Math.random() * authors.length)];
}

/**
 * Resolve tag objects (find existing or create new).
 */
async function resolveTags(tagNames) {
  const client = getClient();
  const existingTags = await client.tags.browse({ limit: 'all' });
  const tagIds = [];

  for (const tagName of tagNames) {
    const existing = existingTags.find(t => t.name === tagName || t.slug === tagName);
    if (existing) {
      tagIds.push({ id: existing.id });
    } else {
      tagIds.push({ name: tagName });
    }
  }

  return tagIds;
}

/**
 * Publish a post to Ghost.
 */
async function publishPost({ title, html, featureImage, tags, authorId }) {
  const client = getClient();

  const post = await client.posts.add(
    {
      title,
      html,
      feature_image: featureImage,
      status: 'published',
      tags,
      authors: [{ id: authorId }],
    },
    { source: 'html' }
  );

  console.log(`Published to Ghost: ${post.url} (author: ${authorId})`);
  return post;
}

/**
 * Fetch all published post titles for a given tag slug.
 * Used for deduplication (e.g., guide topics).
 */
async function fetchPostTitlesByTag(tagSlug) {
  const client = getClient();
  const titles = [];
  let page = 1;

  while (true) {
    const posts = await client.posts.browse({
      filter: `tag:${tagSlug}`,
      fields: 'title',
      limit: 100,
      page,
    });

    for (const post of posts) {
      titles.push(post.title);
    }

    if (posts.length < 100) break;
    page++;
  }

  return titles;
}

module.exports = {
  getClient,
  fetchAuthors,
  getRandomAuthor,
  resolveTags,
  publishPost,
  fetchPostTitlesByTag,
};
