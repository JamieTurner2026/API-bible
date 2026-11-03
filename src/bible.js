'use strict';
const path = require('path');
const { BOOKS, findBook } = require('./books');

const DATA = require(path.join(__dirname, '..', 'data', 'kjv.json'));
const TEXT = new Map(DATA.books.map((b) => [b.id, b.chapters]));

class NotFound extends Error {}
class BadRequest extends Error {}

function bookSummary(b) {
  return {
    number: b.number,
    id: b.id,
    name: b.name,
    slug: b.slug,
    testament: b.testament,
    chapters: TEXT.get(b.id).length,
  };
}

function requireBook(query) {
  const b = findBook(query);
  if (!b) throw new NotFound(`Unknown book: ${query}`);
  return b;
}

function toInt(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new BadRequest(`Invalid ${label}: ${value}`);
  return n;
}

function chapterText(b, chapter) {
  const verses = TEXT.get(b.id)[chapter - 1];
  if (!verses) throw new NotFound(`${b.name} has no chapter ${chapter}`);
  return verses;
}

function verseObj(b, chapter, verse, text) {
  return { book: b.name, bookId: b.id, chapter, verse, reference: `${b.name} ${chapter}:${verse}`, text };
}

function listBooks(testament) {
  let books = BOOKS;
  if (testament) {
    const t = testament.toUpperCase();
    if (t !== 'OT' && t !== 'NT') throw new BadRequest('testament must be OT or NT');
    books = books.filter((b) => b.testament === t);
  }
  return books.map(bookSummary);
}

function getBook(query) {
  const b = requireBook(query);
  return {
    ...bookSummary(b),
    chapterList: TEXT.get(b.id).map((v, i) => ({ chapter: i + 1, verses: v.length })),
  };
}

function getChapter(bookQuery, chapterValue) {
  const b = requireBook(bookQuery);
  const chapter = toInt(chapterValue, 'chapter');
  const verses = chapterText(b, chapter);
  return {
    book: b.name,
    bookId: b.id,
    chapter,
    reference: `${b.name} ${chapter}`,
    verses: verses.map((text, i) => ({ verse: i + 1, text })),
  };
}

function getVerse(bookQuery, chapterValue, verseValue) {
  const b = requireBook(bookQuery);
  const chapter = toInt(chapterValue, 'chapter');
  const verse = toInt(verseValue, 'verse');
  const text = chapterText(b, chapter)[verse - 1];
  if (text === undefined) throw new NotFound(`${b.name} ${chapter} has no verse ${verse}`);
  return verseObj(b, chapter, verse, text);
}

// Parses references such as:
//   "John 3:16", "John 3:16-18", "John 3", "Gen 1-2", "Rom 8:38-9:2", "1 Cor 13:4-7"
const REF_RE = /^\s*(.+?)\s*(\d+)(?::(\d+))?(?:\s*[-–]\s*(\d+)(?::(\d+))?)?\s*$/;

function getPassage(ref) {
  if (!ref) throw new BadRequest('Missing reference, e.g. ?ref=John 3:16-18');
  const m = REF_RE.exec(ref);
  if (!m) throw new BadRequest(`Could not parse reference: ${ref}`);
  const b = requireBook(m[1]);
  const startCh = toInt(m[2], 'chapter');
  let startV = m[3] ? toInt(m[3], 'verse') : 1;
  let endCh, endV;

  if (m[4] === undefined) {
    // Single chapter or single verse.
    endCh = startCh;
    endV = m[3] ? startV : chapterText(b, startCh).length;
  } else if (m[5] !== undefined) {
    // "8:38-9:2"
    endCh = toInt(m[4], 'chapter');
    endV = toInt(m[5], 'verse');
  } else if (m[3]) {
    // "3:16-18" -> verse range within one chapter
    endCh = startCh;
    endV = toInt(m[4], 'verse');
  } else {
    // "1-2" -> chapter range
    endCh = toInt(m[4], 'chapter');
    endV = chapterText(b, endCh).length;
  }

  if (endCh < startCh || (endCh === startCh && endV < startV)) {
    throw new BadRequest(`Range end comes before start: ${ref}`);
  }

  const verses = [];
  for (let c = startCh; c <= endCh; c++) {
    const text = chapterText(b, c);
    const from = c === startCh ? startV : 1;
    const to = c === endCh ? endV : text.length;
    if (from > text.length) throw new NotFound(`${b.name} ${c} has no verse ${from}`);
    if (to > text.length) throw new NotFound(`${b.name} ${c} has no verse ${to}`);
    for (let v = from; v <= to; v++) verses.push(verseObj(b, c, v, text[v - 1]));
  }

  const first = verses[0];
  const last = verses[verses.length - 1];
  let reference = `${b.name} ${first.chapter}:${first.verse}`;
  if (verses.length > 1) {
    reference += last.chapter === first.chapter ? `-${last.verse}` : `-${last.chapter}:${last.verse}`;
  }
  return { reference, translation: DATA.translation.id, verses, text: verses.map((v) => v.text).join(' ') };
}

function search(query, { limit = 50, offset = 0, book, testament } = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) throw new BadRequest('Search query must be at least 2 characters');
  limit = Math.min(toInt(limit, 'limit'), 500);
  offset = Number(offset) || 0;
  if (offset < 0 || !Number.isInteger(offset)) throw new BadRequest(`Invalid offset: ${offset}`);

  let books = BOOKS;
  if (book) books = [requireBook(book)];
  if (testament) {
    const t = testament.toUpperCase();
    if (t !== 'OT' && t !== 'NT') throw new BadRequest('testament must be OT or NT');
    books = books.filter((b) => b.testament === t);
  }

  const needle = q.toLowerCase();
  const results = [];
  let total = 0;
  for (const b of books) {
    TEXT.get(b.id).forEach((verses, ci) => {
      verses.forEach((text, vi) => {
        if (text.toLowerCase().includes(needle)) {
          if (total >= offset && results.length < limit) results.push(verseObj(b, ci + 1, vi + 1, text));
          total++;
        }
      });
    });
  }
  return { query: q, total, offset, limit, results };
}

function randomVerse(rand = Math.random) {
  const b = BOOKS[Math.floor(rand() * BOOKS.length)];
  const chapters = TEXT.get(b.id);
  const ci = Math.floor(rand() * chapters.length);
  const vi = Math.floor(rand() * chapters[ci].length);
  return verseObj(b, ci + 1, vi + 1, chapters[ci][vi]);
}

function stats() {
  let chapters = 0;
  let verses = 0;
  for (const c of TEXT.values()) {
    chapters += c.length;
    for (const v of c) verses += v.length;
  }
  return { translation: DATA.translation, books: BOOKS.length, chapters, verses };
}

module.exports = {
  NotFound, BadRequest, listBooks, getBook, getChapter, getVerse, getPassage, search, randomVerse, stats,
};
