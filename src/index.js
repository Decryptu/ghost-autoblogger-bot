require('dotenv').config();
const cron = require('node-cron');
const config = require('./config');
const { runNewsAgent } = require('./agents/newsAgent');
const { runGuideAgent } = require('./agents/guideAgent');

// Wrap agent runs with error handling
async function safeRun(name, fn) {
  try {
    await fn();
    return true;
  } catch (error) {
    console.error(`[${name}] Fatal error:`, error);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);

  // One-shot mode for external schedulers such as cron.
  if (args.includes('--news')) {
    console.log('Running News Agent immediately (one-shot mode)');
    const ok = await safeRun('NewsAgent', runNewsAgent);
    process.exit(ok ? 0 : 1);
  }

  if (args.includes('--guide')) {
    console.log('Running Guide Agent immediately (one-shot mode)');
    const ok = await safeRun('GuideAgent', runGuideAgent);
    process.exit(ok ? 0 : 1);
  }

  if (args.includes('--run')) {
    console.log('Running both agents immediately (one-shot mode)');
    const newsOk = await safeRun('NewsAgent', runNewsAgent);
    const guideOk = await safeRun('GuideAgent', runGuideAgent);
    process.exit(newsOk && guideOk ? 0 : 1);
  }

  // Persistent scheduler mode.
  cron.schedule(config.NEWS_CRON, () => {
    console.log(`[${new Date().toISOString()}] Scheduled: News Agent`);
    safeRun('NewsAgent', runNewsAgent);
  });

  cron.schedule(config.GUIDE_CRON, () => {
    console.log(`[${new Date().toISOString()}] Scheduled: Guide Agent`);
    safeRun('GuideAgent', runGuideAgent);
  });

  console.log('Pandia Autoblogger Bot is running.');
  console.log(`  News:  ${config.NEWS_CRON} (7h & 19h)`);
  console.log(`  Guide: ${config.GUIDE_CRON} (12h)`);
  console.log('');
  console.log('CLI options:');
  console.log('  --news   Run news agent now');
  console.log('  --guide  Run guide agent now');
  console.log('  --run    Run both agents now');
}

main().catch((error) => {
  console.error('[Main] Fatal error:', error);
  process.exit(1);
});
