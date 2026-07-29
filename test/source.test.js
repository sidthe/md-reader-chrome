import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFilesSource, queryFilesPermission, requestFilesPermission } from '../lib/source.js';

// Minimal FileSystemFileHandle stand-in.
function fileHandle(name, text = '# ' + name, perm = 'granted') {
  let state = perm;
  return {
    kind: 'file',
    name,
    async getFile() {
      return { text: async () => text, size: text.length, lastModified: 0 };
    },
    async queryPermission() {
      return state;
    },
    async requestPermission() {
      state = state === 'denied' ? 'denied' : 'granted';
      return state;
    },
  };
}

test('files source builds a flat, sorted tree', async () => {
  const src = createFilesSource([fileHandle('zoo.md'), fileHandle('Alpha.md')]);
  const tree = await src.tree();
  assert.equal(tree.dirs.length, 0);
  assert.deepEqual(tree.files.map((f) => f.path), ['Alpha.md', 'zoo.md']);
  assert.equal(src.name, '2 files');
});

test('files source reads content by path', async () => {
  const src = createFilesSource([fileHandle('README.md', '# hi')]);
  const r = await src.read('README.md');
  assert.equal(r.text, '# hi');
  assert.equal(r.size, 4);
});

test('duplicate names are disambiguated and both remain readable', async () => {
  const src = createFilesSource([
    fileHandle('README.md', 'first'),
    fileHandle('README.md', 'second'),
  ]);
  const paths = (await src.tree()).files.map((f) => f.path);
  assert.deepEqual(paths.sort(), ['README (2).md', 'README.md']);
  assert.equal((await src.read('README.md')).text, 'first');
  assert.equal((await src.read('README (2).md')).text, 'second');
});

test('reading an unknown path throws NotFoundError', async () => {
  const src = createFilesSource([fileHandle('a.md')]);
  await assert.rejects(() => src.read('nope.md'), (e) => e.name === 'NotFoundError');
});

test('queryFilesPermission is granted only when all handles are', async () => {
  assert.equal(await queryFilesPermission([fileHandle('a.md'), fileHandle('b.md')]), 'granted');
  assert.equal(
    await queryFilesPermission([fileHandle('a.md'), fileHandle('b.md', 'x', 'prompt')]),
    'prompt'
  );
});

test('requestFilesPermission returns only the granted subset', async () => {
  const ok = fileHandle('a.md', 'x', 'prompt');
  const bad = fileHandle('b.md', 'x', 'denied');
  const granted = await requestFilesPermission([ok, bad]);
  assert.deepEqual(granted, [ok]);
});
