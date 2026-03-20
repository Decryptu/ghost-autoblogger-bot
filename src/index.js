require('dotenv').config();
const cron = require('node-cron');
const config = require('./config');
const { runNewsAgent } = require('./agents/newsAgent');
const { runGuideAgent } = require('./agents/guideAgent');

// Wrap agent runs with error handling
async function safeRun(name, fn) {
  try {
    await fn();
  } catch (error) {
    console.error(`[${name}] Fatal error:`, error);
  }
}

// CLI: immediate run support
const args = process.argv.slice(2);

if (args.includes('--news')) {
  console.log('Running News Agent immediately (test mode)');
  safeRun('NewsAgent', runNewsAgent);
} else if (args.includes('--guide')) {
  console.log('Running Guide Agent immediately (test mode)');
  safeRun('GuideAgent', runGuideAgent);
} else if (args.includes('--run')) {
  console.log('Running both agents immediately (test mode)');
  safeRun('NewsAgent', runNewsAgent);
  safeRun('GuideAgent', runGuideAgent);
}

// Schedule news articles (7 AM and 7 PM)
cron.schedule(config.NEWS_CRON, () => {
  console.log(`[${new Date().toISOString()}] Scheduled: News Agent`);
  safeRun('NewsAgent', runNewsAgent);
});

// Schedule guide articles (noon daily)
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
