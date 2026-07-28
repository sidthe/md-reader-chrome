// Markdown pipeline structure tests against the vendored builds (the exact
// bytes that ship). DOMPurify needs a real DOM, so these run pre-sanitize;
// sanitizer behavior is covered by test/browser/harness.html in real Chrome.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createRenderer, createSlugger } from '../lib/render.js';

const req = createRequire(import.meta.url);
const markdownit = req('../vendor/markdown-it.min.js');
const taskLists = req('../vendor/markdown-it-task-lists.min.js');
const hljs = req('../vendor/highlight.min.js');
const PASSTHROUGH_SANITIZER = { sanitize: (html) => html };

const { render } = createRenderer({ markdownit, taskLists, hljs, DOMPurify: PASSTHROUGH_SANITIZER });

test('GFM table renders', () => {
  const html = render('| a | b |\n|---|---|\n| 1 | 2 |');
  assert.match(html, /<table>/);
  assert.match(html, /<th>a<\/th>/);
  assert.match(html, /<td>2<\/td>/);
});

test('task list renders disabled checkboxes', () => {
  const html = render('- [x] done\n- [ ] todo');
  assert.match(html, /<input[^>]*type="checkbox"[^>]*>/);
  assert.match(html, /checked/);
  assert.match(html, /disabled/);
  assert.match(html, /task-list-item/);
});

test('strikethrough and autolink', () => {
  assert.match(render('~~gone~~'), /<s>gone<\/s>/);
  assert.match(render('see https://example.com now'), /<a href="https:\/\/example\.com">/);
});

test('fenced code is highlighted for known languages', () => {
  const html = render('```js\nconst x = 1;\n```');
  assert.match(html, /class="language-js"/);
  assert.match(html, /hljs-keyword/);
});

test('fenced code with unknown language is escaped, not highlighted', () => {
  const html = render('```nosuchlang\n<b>&\n```');
  assert.match(html, /&lt;b&gt;&amp;/);
  assert.doesNotMatch(html, /hljs-/);
});

for (const [marker, cls, title] of [
  ['NOTE', 'markdown-alert-note', 'Note'],
  ['TIP', 'markdown-alert-tip', 'Tip'],
  ['IMPORTANT', 'markdown-alert-important', 'Important'],
  ['WARNING', 'markdown-alert-warning', 'Warning'],
  ['CAUTION', 'markdown-alert-caution', 'Caution'],
]) {
  test(`alert [!${marker}]`, () => {
    const html = render(`> [!${marker}]\n> body text`);
    assert.match(html, new RegExp(`<div class="markdown-alert ${cls}">`));
    assert.match(html, new RegExp(`markdown-alert-title[^<]*<svg[\\s\\S]*?</svg>${title}</p>`));
    assert.match(html, /body text/);
    assert.doesNotMatch(html, /\[!/);
    assert.doesNotMatch(html, /<blockquote>/);
  });
}

test('alert marker mid-blockquote is NOT an alert', () => {
  const html = render('> some text\n> [!NOTE]');
  assert.match(html, /<blockquote>/);
  assert.doesNotMatch(html, /markdown-alert/);
});

test('alert with multi-paragraph body keeps both paragraphs', () => {
  const html = render('> [!WARNING]\n> first\n>\n> second');
  assert.match(html, /first/);
  assert.match(html, /second/);
  assert.match(html, /markdown-alert-warning/);
});

test('plain blockquote stays a blockquote', () => {
  const html = render('> quoted');
  assert.match(html, /<blockquote>/);
});

test('headings get GitHub-style ids and anchor links', () => {
  const html = render('## Hello World!\n\n## Hello World!');
  assert.match(html, /<h2 id="user-content-hello-world">/);
  assert.match(html, /<h2 id="user-content-hello-world-1">/);
  assert.match(html, /<a class="anchor" href="#hello-world"[^>]*>/);
  assert.match(html, /octicon-link/);
});

test('slugger matches GitHub behavior', () => {
  const slug = createSlugger();
  assert.equal(slug('Hello World'), 'hello-world');
  assert.equal(slug("What's New? (v2.0)"), 'whats-new-v20');
  assert.equal(slug('Hello World'), 'hello-world-1');
  assert.equal(slug('under_score -dash'), 'under_score--dash');
});

test('relative links and images pass through for app-layer resolution', () => {
  const html = render('[guide](docs/guide.md)\n\n![logo](img/logo.png)');
  assert.match(html, /<a href="docs\/guide\.md">/);
  assert.match(html, /<img src="img\/logo\.png" alt="logo">/);
});
