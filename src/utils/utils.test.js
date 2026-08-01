const assert = require('node:assert/strict');
const { test } = require('node:test');
const { extractJson, extractJsonArray } = require('./json');
const { markdownToHtml } = require('./markdown');
const { memo } = require('./cache');

test('extractJson reads the first bracket, whichever kind it is', () => {
  // The classic failure: scanning for '[' first returns the inner array.
  assert.deepEqual(extractJson('noise {"items": [1, 2]} tail'), { items: [1, 2] });
  assert.deepEqual(extractJson('[{"a": 1}]'), [{ a: 1 }]);
  assert.equal(extractJson('no json here'), null);
});

test('extractJson survives fences, nesting and brackets inside strings', () => {
  assert.deepEqual(extractJson('```json\n[{"a": "] } ["}]\n```'), [{ a: '] } [' }]);
  assert.deepEqual(extractJson('{"a": {"b": [1]}}'), { a: { b: [1] } });
  assert.equal(extractJson('[{"a": 1}'), null);
});

test('extractJsonArray unwraps an object that wraps the array', () => {
  assert.deepEqual(extractJsonArray('{"candidates": [{"headline": "x"}]}'), [{ headline: 'x' }]);
  assert.deepEqual(extractJsonArray('[1, 2]'), [1, 2]);
  assert.deepEqual(extractJsonArray('garbage'), []);
});

test('markdownToHtml renders headings, lists, quotes and inline marks', () => {
  const html = markdownToHtml(
    [
      '# dropped',
      '## Titre',
      'Un **fait** et un *terme*.',
      '',
      '1. un',
      '2. deux',
      '',
      '- a',
      '- b',
      '',
      '> cité',
      'Voir [ici](https://x.dev).',
    ].join('\n'),
  );

  assert.equal(html.includes('<h1>'), false);
  assert.equal(html.includes('<h2>Titre</h2>'), true);
  assert.equal(html.includes('<strong>fait</strong>'), true);
  assert.equal(html.includes('<em>terme</em>'), true);
  assert.equal(html.includes('<ol>\n<li>un</li>\n<li>deux</li>\n</ol>'), true);
  assert.equal(html.includes('<ul>\n<li>a</li>\n<li>b</li>\n</ul>'), true);
  assert.equal(html.includes('<blockquote>cité</blockquote>'), true);
  assert.equal(html.includes('<a href="https://x.dev">ici</a>'), true);
});

test('memo serves one call per key until the ttl expires', async () => {
  let calls = 0;
  const load = memo(async key => {
    calls++;
    return key;
  }, 50);

  assert.deepEqual(await Promise.all([load('a'), load('a'), load('b')]), ['a', 'a', 'b']);
  assert.equal(calls, 3); // concurrent calls are not deduped, sequential ones are
  await load('a');
  assert.equal(calls, 3);
});
