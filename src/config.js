const WRITER_MODEL = 'gpt-5.6-luna';
const WORKER_MODEL = 'gpt-6-luna';

// maxTokens must cover reasoning tokens plus the visible answer.
const TASKS = {
  newsDiscovery: { model: WORKER_MODEL, effort: 'low', maxTokens: 8000, search: true },
  article: { model: WRITER_MODEL, effort: 'high', maxTokens: 6000 },
  articleMeta: { model: WRITER_MODEL, effort: 'high', maxTokens: 2000 },
  guide: { model: WRITER_MODEL, effort: 'high', maxTokens: 9000 },
  guideTopic: { model: WORKER_MODEL, effort: 'low', maxTokens: 1000 },
  imagePick: { model: WORKER_MODEL, effort: 'none', maxTokens: 100 },
};

module.exports = {
  TASKS,

  NEWS_CRON: '0 7,19 * * *',
  GUIDE_CRON: '0 12 * * *',

  GHOST_CACHE_TTL_MS: 5 * 60 * 1000,

  DEFAULT_IMAGE_URL: 'https://images.unsplash.com/photo-1717501218636-a390f9ac5957',
};
