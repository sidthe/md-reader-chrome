import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePath, isMarkdown, walk, SKIP_DIRS } from '../lib/fs.js';

test('isMarkdown', () => {
  assert.ok(isMarkdown('README.md'));
  assert.ok(isMarkdown('notes.MARKDOWN'));
  assert.ok(!isMarkdown('image.png'));
  assert.ok(!isMarkdown('md'));
});

test('resolvePath: sibling, subdir, parent', () => {
  assert.equal(resolvePath('docs/a.md', 'b.md'), 'docs/b.md');
  assert.equal(resolvePath('docs/a.md', './b.md'), 'docs/b.md');
  assert.equal(resolvePath('docs/a.md', 'sub/c.md'), 'docs/sub/c.md');
  assert.equal(resolvePath('docs/a.md', '../README.md'), 'README.md');
  assert.equal(resolvePath('README.md', 'docs/guide.md'), 'docs/guide.md');
});

test('resolvePath: root-absolute resolves from picked root', () => {
  assert.equal(resolvePath('docs/deep/a.md', '/README.md'), 'README.md');
});

test('resolvePath: escaping the root returns null', () => {
  assert.equal(resolvePath('a.md', '../outside.md'), null);
  assert.equal(resolvePath('docs/a.md', '../../outside.md'), null);
});

test('resolvePath: URLs with a scheme return null', () => {
  assert.equal(resolvePath('a.md', 'https://example.com/x.md'), null);
  assert.equal(resolvePath('a.md', 'mailto:x@example.com'), null);
});

// Minimal in-memory stand-in for FileSystemDirectoryHandle.
function mockDir(name, entries) {
  return {
    kind: 'directory',
    name,
    async *values() {
      for (const e of entries) yield e;
    },
  };
}
const mockFile = (name) => ({ kind: 'file', name });

test('walk: skips .git/node_modules, prunes md-less dirs, sorts', async () => {
  const root = mockDir('repo', [
    mockFile('zebra.md'),
    mockFile('binary.png'),
    mockDir('.git', [mockFile('HEAD.md')]),
    mockDir('node_modules', [mockFile('x.md')]),
    mockDir('src', [mockFile('code.js')]),
    mockDir('docs', [mockFile('b.md'), mockFile('A.md')]),
    mockFile('README.md'),
  ]);
  const tree = await walk(root);
  assert.deepEqual(tree.dirs.map((d) => d.name), ['docs']);
  assert.deepEqual(tree.files.map((f) => f.name), ['README.md', 'zebra.md']);
  assert.deepEqual(tree.dirs[0].files.map((f) => f.path), ['docs/A.md', 'docs/b.md']);
  assert.ok(SKIP_DIRS.has('.git') && SKIP_DIRS.has('node_modules'));
});
