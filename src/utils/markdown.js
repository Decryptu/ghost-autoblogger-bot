/**
 * Convert markdown content to HTML for Ghost.
 * Handles headers, bold, italic, blockquotes, and paragraphs.
 */
function markdownToHtml(markdown) {
  return markdown
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (trimmed === '') return '';

      // Headers (h2-h6 only, skip h1)
      const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        if (level === 1) return '';
        const text = headerMatch[2].replace(/\*\*/g, '');
        return `<h${level}>${text}</h${level}>`;
      }

      // Blockquotes
      if (trimmed.startsWith('>')) {
        const quoteText = trimmed.replace(/^>\s*/, '');
        return `<blockquote>${processInline(quoteText)}</blockquote>`;
      }

      // Regular paragraph
      return `<p>${processInline(trimmed)}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Process inline markdown: bold first, then italic.
 */
function processInline(text) {
  // Bold: **text**
  let result = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text* or _text_ (but not inside words with underscores)
  result = result.replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, '<em>$1</em>');
  result = result.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>');
  return result;
}

module.exports = { markdownToHtml };
