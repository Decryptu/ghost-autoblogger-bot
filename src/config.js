module.exports = {
  OPENAI_MODEL: 'gpt-5.1',

  // Cron schedules
  NEWS_CRON: '0 7,19 * * *',       // News articles at 7 AM and 7 PM
  GUIDE_CRON: '0 12 * * *',        // Guide article at noon daily

  // Fallback image if all Unsplash searches fail
  DEFAULT_IMAGE_URL: 'https://images.unsplash.com/photo-1717501218636-a390f9ac5957',
};
