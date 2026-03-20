const fs = require('node:fs').promises;
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const PROCESSED_ARTICLES_FILE = path.join(ROOT, 'processed_articles.json');
const GENERATED_DIR = path.join(ROOT, 'generated_articles');

/**
 * Load processed article titles from JSON file.
 */
async function loadProcessedArticles() {
  try {
    const data = await fs.readFile(PROCESSED_ARTICLES_FILE, 'utf-8');
    return new Set(JSON.parse(data));
  } catch {
    await fs.writeFile(PROCESSED_ARTICLES_FILE, JSON.stringify([]));
    return new Set();
  }
}

/**
 * Save processed article titles to JSON file.
 * Keeps only the last 500 entries if over 1000.
 */
async function saveProcessedArticles(articles) {
  let arr = [...articles];
  if (arr.length > 1000) {
    arr = arr.slice(-500);
  }
  await fs.writeFile(PROCESSED_ARTICLES_FILE, JSON.stringify(arr, null, 2));
}

/**
 * Save a generated article as a local markdown file.
 */
async function saveLocally(title, content, imageUrl, tags) {
  await fs.mkdir(GENERATED_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const slug = title.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 80);
  const fileName = `${timestamp}-${slug}.md`;
  const filePath = path.join(GENERATED_DIR, fileName);

  const fileContent = `---
title: ${title}
feature_image: ${imageUrl}
status: draft
date: ${new Date().toISOString()}
tags: [${tags.map(t => `'${t}'`).join(', ')}]
---

${content}`;

  await fs.writeFile(filePath, fileContent);
  console.log(`Saved locally: ${fileName}`);
}

module.exports = { loadProcessedArticles, saveProcessedArticles, saveLocally };
