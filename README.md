# Ghost Autoblogger Bot 🤖

Automated French content for a Ghost blog. Two independent agents:

- **News agent** — finds fresh AI news with hosted web search, writes the article, then derives a Google Discover–optimized title and its image keywords.
- **Guide agent** — picks an unpublished evergreen SEO topic and writes a long-form guide for Google Search.

Both publish straight to Ghost with a featured Unsplash image, a random staff author, and a local markdown copy in `generated_articles/`.

## Model strategy

Everything runs on a single model, `gpt-5.6-luna`, with **reasoning effort as the only dial**. As of August 2026 the whole capability/cost Pareto frontier is held by Luna effort levels — no GPT-5.4 configuration is the best choice at any budget. The `gpt-5.6` alias routes to Sol, so the Luna id is spelled out.

Per-task profiles live in [`src/config.js`](src/config.js) — one place for model, effort and output caps:

| Task | Effort | Why |
|---|---|---|
| `newsDiscovery` | `low` | Web search injects ~8.6k input tokens per call; keep the model cheap here. |
| `article` | `high` | The product. |
| `articleMeta` | `high` | The Discover title is the #1 CTR lever. |
| `guide` | `high` | Long-form SEO. |
| `guideTopic` | `low` | Pick a topic, avoid duplicates. |
| `imagePick` | `none` | Selection from a supplied list. |

Caps are `max_output_tokens` and must cover reasoning tokens *plus* the answer; they sit just above the real envelope so runaway responses surface instead of hiding.

## Cost discipline

- **Prompt caching**: every call splits stable content (`instructions`) from volatile content (`input`). Caching matches a prefix, so one changed byte at the front discards the rest. No `prompt_cache_key` is set — it scopes the cache to a namespace that starts empty and lowers the hit rate.
- **Cached share is logged per call**: `[openai:article] in=1841 cached=1536 (83%) out=2210`. That ratio moves long before a bill does; a sustained drop means a prefix drifted.
- **Merged calls**: title + image keywords are one call, guide topic + image keywords are one call. Each merged prompt states explicitly that its deliverables are judged independently — merging can otherwise collapse one answer into the other.
- **Dedup lists are never numbered.** Positional labels renumber the whole block whenever an entry ages out, rewriting it from its first byte.
- **Ghost reads are memoized** in-process (authors, tags, guide archive), so `--run` does not fetch the same thing twice.

Structured outputs (strict JSON schema) are used everywhere except the search-backed discovery call — JSON mode and the hosted search tool are mutually exclusive, so that one recovers JSON with a tolerant parser ([`src/utils/json.js`](src/utils/json.js)).

## Setup

```bash
bun install
cp .env.example .env
```

Fill `.env`:

```env
OPENAI_API_KEY=
GHOST_API_URL=
GHOST_ADMIN_API_KEY=
UNSPLASH_ACCESS_KEY=
```

## Usage

```bash
bun run news     # one-shot: news article
bun run guide    # one-shot: SEO guide
bun run run      # one-shot: both
bun start        # persistent scheduler (node-cron)
```

One-shot mode exits non-zero on failure, so system cron can alert on it. Schedules live in `src/config.js` (`NEWS_CRON`, `GUIDE_CRON`).

## Quality gates

```bash
bun run check
```

Runs Biome (lint + format), TypeScript in `checkJs` mode, and the unit tests. Nothing should be committed with a warning.

## Structure

```
src/
├── index.js              # CLI + scheduler
├── config.js             # model, per-task effort/caps, schedules
├── agents/
│   ├── newsAgent.js      # Discover pipeline
│   └── guideAgent.js     # SEO pipeline
├── services/
│   ├── openai.js         # single API entry point, usage logging
│   ├── newsDiscovery.js  # web-search veille
│   ├── ghost.js          # publishing + memoized reads
│   └── unsplash.js       # image search + AI pick
└── utils/                # json, markdown, cache, env
```

## License

MIT — see LICENSE.
