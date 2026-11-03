'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createServer } = require('../src/server');

let server;
let base;

test.before(async () => {
  server = createServer();
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
test.after(() => server.close());

async function get(path) {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json() };
}

test('root reports full Bible stats', async () => {
  const { status, body } = await get('/');
  assert.strictEqual(status, 200);
  assert.strictEqual(body.books, 66);
  assert.strictEqual(body.chapters, 1189);
  assert.strictEqual(body.verses, 31102);
});

test('lists books and filters by testament', async () => {
  assert.strictEqual((await get('/books')).body.length, 66);
  assert.strictEqual((await get('/books?testament=OT')).body.length, 39);
  assert.strictEqual((await get('/books?testament=nt')).body.length, 27);
});

test('book lookup accepts names, slugs, ids, abbreviations and numbers', async () => {
  for (const q of ['1 John', '1-john', '1John', '1jn', 'I John', 'First John', '62']) {
    const { status, body } = await get(`/books/${encodeURIComponent(q)}`);
    assert.strictEqual(status, 200, q);
    assert.strictEqual(body.name, '1 John', q);
  }
  assert.strictEqual((await get('/books/Psalms')).body.chapters, 150);
  assert.strictEqual((await get('/books/nope')).status, 404);
});

test('chapter and verse', async () => {
  const ch = await get('/books/psalms/chapters/119');
  assert.strictEqual(ch.body.verses.length, 176);
  const v = await get('/books/john/chapters/3/verses/16');
  assert.strictEqual(v.status, 200);
  assert.match(v.body.text, /^For God so loved the world/);
  assert.strictEqual(v.body.reference, 'John 3:16');
  assert.strictEqual((await get('/books/john/chapters/22')).status, 404);
  assert.strictEqual((await get('/books/john/chapters/3/verses/99')).status, 404);
  assert.strictEqual((await get('/books/john/chapters/abc')).status, 400);
});

test('passage references', async () => {
  const cases = [
    ['John 3:16', 'John 3:16', 1],
    ['John 3:16-18', 'John 3:16-18', 3],
    ['Jude 1', 'Jude 1:1-25', 25],
    ['Gen 1-2', 'Genesis 1:1-2:25', 56],
    ['Rom 8:38-9:2', 'Romans 8:38-9:2', 4],
    ['1 Cor 13:4-7', '1 Corinthians 13:4-7', 4],
  ];
  for (const [ref, expected, count] of cases) {
    const { status, body } = await get(`/passage?ref=${encodeURIComponent(ref)}`);
    assert.strictEqual(status, 200, ref);
    assert.strictEqual(body.reference, expected, ref);
    assert.strictEqual(body.verses.length, count, ref);
  }
  assert.strictEqual((await get('/passage?ref=John 3:18-16')).status, 400);
  assert.strictEqual((await get('/passage')).status, 400);
});

test('search', async () => {
  const { body } = await get('/search?q=one%20and%20only%20Son&book=John');
  assert.ok(body.total >= 2);
  assert.ok(body.results.every((r) => r.bookId === 'John'));
  const paged = await get('/search?q=love&limit=5&offset=5');
  assert.strictEqual(paged.body.results.length, 5);
  assert.strictEqual((await get('/search?q=a')).status, 400);
});

test('verses omitted by the BSB keep their numbering and are flagged', async () => {
  const v = await get('/books/matthew/chapters/17/verses/21');
  assert.strictEqual(v.status, 200);
  assert.strictEqual(v.body.omitted, true);
  assert.ok(v.body.note);
  const p = await get('/passage?ref=Matt 17:20-22');
  assert.strictEqual(p.body.verses.length, 3);
  assert.ok(!p.body.text.includes('  '));
});

test('random verse', async () => {
  const { status, body } = await get('/random');
  assert.strictEqual(status, 200);
  assert.ok(body.text.length > 0);
});
