'use strict';
const http = require('http');
const bible = require('./bible');

const ROUTES = [
  ['/', () => ({
    name: 'API Bible',
    ...bible.stats(),
    usage: `Add ?translation=<id> to any endpoint to choose a translation (default: ${bible.DEFAULT_TRANSLATION}).`,
    endpoints: {
      'GET /translations': 'List the available translations',
      'GET /books': 'List all books (?testament=OT|NT)',
      'GET /books/:book': 'Book details with verse counts per chapter',
      'GET /books/:book/chapters/:chapter': 'All verses in a chapter',
      'GET /books/:book/chapters/:chapter/verses/:verse': 'A single verse',
      'GET /passage?ref=John 3:16-18': 'Look up a reference or range',
      'GET /compare?ref=John 3:16&translations=bsb,web,asv': 'A passage side by side in several translations',
      'GET /search?q=love&limit=50&offset=0&book=John&testament=NT': 'Full-text search',
      'GET /random': 'A random verse',
    },
  })],
  ['/translations', () => bible.listTranslations()],
  ['/books', (p, q) => bible.listBooks(q.get('testament'))],
  ['/books/:book', (p, q) => bible.getBook(p.book, q.get('translation'))],
  ['/books/:book/chapters/:chapter', (p, q) => bible.getChapter(p.book, p.chapter, q.get('translation'))],
  ['/books/:book/chapters/:chapter/verses/:verse',
    (p, q) => bible.getVerse(p.book, p.chapter, p.verse, q.get('translation'))],
  ['/passage', (p, q) => bible.getPassage(q.get('ref'), q.get('translation'))],
  ['/compare', (p, q) => bible.compare(q.get('ref'), q.get('translations'))],
  ['/search', (p, q) => bible.search(q.get('q'), {
    limit: q.get('limit') || 50,
    offset: q.get('offset') || 0,
    book: q.get('book'),
    testament: q.get('testament'),
    translation: q.get('translation'),
  })],
  ['/random', (p, q) => bible.randomVerse(q.get('translation'))],
].map(([pattern, handler]) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$');
  return { re, keys, handler };
});

// Scripture never changes, so successful responses can be cached by browsers and the CDN for a day.
const CACHE_OK = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';

function send(res, status, body, cache = status === 200 ? CACHE_OK : 'no-store') {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': cache,
  });
  res.end(JSON.stringify(body, null, 2));
}

function handle(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' });
    return res.end();
  }
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  const url = new URL(req.url, 'http://localhost');
  for (const { re, keys, handler } of ROUTES) {
    const m = re.exec(url.pathname);
    if (!m) continue;
    const params = {};
    try {
      keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return send(res, 200, handler(params, url.searchParams), url.pathname.startsWith('/random') ? 'no-store' : undefined);
    } catch (err) {
      if (err instanceof bible.NotFound) return send(res, 404, { error: err.message });
      if (err instanceof bible.BadRequest || err instanceof URIError) return send(res, 400, { error: err.message });
      console.error(err);
      return send(res, 500, { error: 'Internal server error' });
    }
  }
  send(res, 404, { error: `No route for ${url.pathname}` });
}

function createServer() {
  return http.createServer(handle);
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, () => console.log(`API Bible listening on http://localhost:${port}`));
}

module.exports = { createServer, handle };
