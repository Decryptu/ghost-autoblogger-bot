/**
 * Single source of truth for model selection, per-task budgets and schedules.
 *
 * GPT-6 Luna matches GPT-5.6 Luna on overall intelligence at well under half
 * the price and hallucinates less, but scores lower on human-read deliverables
 * (AA-Briefcase, GDPval). So it runs the machine-read tasks, while published
 * prose stays on GPT-5.6 Luna. The `gpt-5.6` alias routes to Sol, so the Luna
 * id is spelled out explicitly.
 */
const WRITER_MODEL = 'gpt-5.6-luna';
const WORKER_MODEL = 'gpt-6-luna';

/**
 * Per-task profiles. `maxTokens` is a max_output_tokens cap that must cover
 * reasoning tokens *plus* the visible answer — caps sit just above the real
 * envelope so runaway responses surface instead of hiding.
 */
const TASKS = {
  // Web search injects ~8.6k input tokens per call: keep effort cheap here.
  newsDiscovery: { model: WORKER_MODEL, effort: 'low', maxTokens: 8000, search: true },
  // ~600-1200 French words + reasoning headroom.
  article: { model: WRITER_MODEL, effort: 'high', maxTokens: 6000 },
  // Discover title is the #1 CTR lever — worth real reasoning budget.
  articleMeta: { model: WRITER_MODEL, effort: 'high', maxTokens: 2000 },
  // ~1500-2000 French words + reasoning headroom.
  guide: { model: WRITER_MODEL, effort: 'high', maxTokens: 9000 },
  guideTopic: { model: WORKER_MODEL, effort: 'low', maxTokens: 1000 },
  // Pure selection from a provided list: no reasoning needed.
  imagePick: { model: WORKER_MODEL, effort: 'none', maxTokens: 100 },
};

module.exports = {
  TASKS,

  // Cron schedules
  NEWS_CRON: '0 7,19 * * *', // News articles at 7 AM and 7 PM
  GUIDE_CRON: '0 12 * * *', // Guide article at noon daily

  // In-process TTL for Ghost lookups reused across agents in one run.
  GHOST_CACHE_TTL_MS: 5 * 60 * 1000,

  // Fallback image if all Unsplash searches fail
  DEFAULT_IMAGE_URL: 'https://images.unsplash.com/photo-1717501218636-a390f9ac5957',
};
