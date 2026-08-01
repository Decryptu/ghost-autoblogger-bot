/**
 * Single source of truth for model selection, per-task budgets and schedules.
 *
 * Model choice (Aug 2026): the whole capability/cost Pareto frontier is held by
 * GPT-5.6 Luna effort levels — no GPT-5.4 configuration is the best choice at
 * any budget. So we run one model everywhere and use `effort` as the only dial.
 * The `gpt-5.6` alias routes to Sol, so the Luna id is spelled out explicitly.
 */
const MODEL = 'gpt-5.6-luna';

/**
 * Per-task profiles. `maxTokens` is a max_output_tokens cap that must cover
 * reasoning tokens *plus* the visible answer — caps sit just above the real
 * envelope so runaway responses surface instead of hiding.
 */
const TASKS = {
  // Web search injects ~8.6k input tokens per call: keep effort cheap here.
  newsDiscovery: { effort: 'low', maxTokens: 8000, search: true },
  // ~600-1200 French words + reasoning headroom.
  article: { effort: 'high', maxTokens: 6000 },
  // Discover title is the #1 CTR lever — worth real reasoning budget.
  articleMeta: { effort: 'high', maxTokens: 2000 },
  // ~1500-2000 French words + reasoning headroom.
  guide: { effort: 'high', maxTokens: 9000 },
  guideTopic: { effort: 'low', maxTokens: 1000 },
  // Pure selection from a provided list: no reasoning needed.
  imagePick: { effort: 'none', maxTokens: 100 },
};

module.exports = {
  MODEL,
  TASKS,

  // Cron schedules
  NEWS_CRON: '0 7,19 * * *', // News articles at 7 AM and 7 PM
  GUIDE_CRON: '0 12 * * *', // Guide article at noon daily

  // In-process TTL for Ghost lookups reused across agents in one run.
  GHOST_CACHE_TTL_MS: 5 * 60 * 1000,

  // Fallback image if all Unsplash searches fail
  DEFAULT_IMAGE_URL: 'https://images.unsplash.com/photo-1717501218636-a390f9ac5957',
};
