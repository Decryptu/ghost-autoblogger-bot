const HEADING = /^(#{1,6})\s+(.+)$/;
const BULLET = /^[-*+]\s+(.+)$/;
const ORDERED = /^\d+[.)]\s+(.+)$/;

function processInline(text) {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, '<em>$1</em>')
    .replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>');
}

function markdownToHtml(markdown) {
  const out = [];
  /** @type {{ tag: 'ul' | 'ol', items: string[] } | null} */
  let list = null;

  const flushList = () => {
    if (!list) return;
    const items = list.items.map(i => `<li>${processInline(i)}</li>`).join('\n');
    out.push(`<${list.tag}>\n${items}\n</${list.tag}>`);
    list = null;
  };

  const pushItem = (tag, item) => {
    if (!list || list.tag !== tag) {
      flushList();
      list = { tag, items: [] };
    }
    list.items.push(item);
  };

  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();

    if (trimmed === '') {
      flushList();
      continue;
    }

    const bullet = trimmed.match(BULLET);
    if (bullet) {
      pushItem('ul', bullet[1]);
      continue;
    }

    const ordered = trimmed.match(ORDERED);
    if (ordered) {
      pushItem('ol', ordered[1]);
      continue;
    }

    flushList();

    const heading = trimmed.match(HEADING);
    if (heading) {
      // h1 is dropped — the post title owns it.
      const level = heading[1].length;
      if (level === 1) continue;
      out.push(`<h${level}>${heading[2].replace(/\*\*/g, '')}</h${level}>`);
      continue;
    }

    if (trimmed.startsWith('>')) {
      out.push(`<blockquote>${processInline(trimmed.replace(/^>\s*/, ''))}</blockquote>`);
      continue;
    }

    out.push(`<p>${processInline(trimmed)}</p>`);
  }

  flushList();
  return out.join('\n');
}

module.exports = { markdownToHtml };
