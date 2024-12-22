# Ghost Autoblogger Bot 🤖

An automated content generation system for Ghost blogs that fetches AI news, translates them to French, and publishes them automatically using OpenAI's GPT-4o.

## Features

- 🔄 Automatically fetches the latest AI news using NewsAPI
- 🤖 Generates high-quality French articles using OpenAI's GPT-4o
- 🖼️ Adds relevant featured images from Unsplash
- 📝 Saves articles locally as markdown files
- 🚀 Publishes directly to your Ghost blog
- ⏰ Runs on a schedule (default: twice daily at 7 AM and 7 PM)
- 🏷️ Automatically adds relevant tags
- 📊 Includes error handling and logging

## Prerequisites

- Node.js (v14 or higher)
- A Ghost blog with Admin API access
- API keys for:
  - OpenAI
  - NewsAPI
  - Unsplash
  - Ghost Content API
  - Ghost Admin API

## Installation

1. Clone the repository:

```bash
git clone https://github.com/Decryptu/ghost-autoblogger-bot.git
cd ghost-autoblogger-bot
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory:

```env
OPENAI_API_KEY=your_openai_key
GHOST_API_URL=your_ghost_url
GHOST_CONTENT_API_KEY=your_ghost_content_key
GHOST_ADMIN_API_KEY=your_ghost_admin_key
UNSPLASH_ACCESS_KEY=your_unsplash_key
NEWS_API_KEY=your_news_api_key
```

## Usage

### Local Development

Run the bot immediately:

```bash
node bot.js --run
```

### Production Deployment

For production, it's recommended to use PM2:

1. Install PM2:

```bash
npm install -g pm2
```

2. Start the bot:

```bash
pm2 start ecosystem.config.js
```

3. Monitor the bot:

```bash
pm2 logs ghost-autoblogger
```

### Configuration

Edit `config.js` to customize:

- OpenAI model
- Article prompt
- Schedule timing
- Default image URL
- Author ID

## File Structure

```
├── bot.js              # Main bot logic
├── config.js           # Configuration settings
├── ecosystem.config.js # PM2 configuration
├── .env               # Environment variables
└── generated_articles/ # Local storage for generated articles
```

## Generated Content

Articles are saved in two places:

1. Locally in the `generated_articles` folder as markdown files
2. Published directly to your Ghost blog

## Customization

### Changing the Schedule

Edit `CRON_SCHEDULE` in `config.js`. Default is twice daily (`0 7,19 * * *`).

### Modifying the Article Style

Edit `ARTICLE_PROMPT` in `config.js` to change the tone, style, or format of generated articles.

### Changing Tags

Modify the tags array in the `publishToGhost` function in `bot.js`.

## Error Handling

The bot includes comprehensive error handling for:

- API failures
- Network issues
- Content generation errors
- Image fetching issues
- Publishing problems

All errors are logged to the console with detailed messages.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see the LICENSE file for details

## Support

For support, please open an issue in the GitHub repository.

## Acknowledgments

- OpenAI GPT-4o for content generation
- Ghost for the amazing blogging platform
- NewsAPI for news sources
- Unsplash for images
