'use strict';
const fs = require('fs');
const path = require('path');
const { BOOKS, findBook } = require('./books');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DEFAULT_TRANSLATION = 'bsb';

// Load every translation in data/ (bsb.json, web.json, asv.json, ...).
const TRANSLATIONS = new Map();
for (const file of fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')).sort()) {
  const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  TRANSLATIONS.set(data.translation.id, {
    meta: data.translation,
    omittedNote: data.omittedNote,
    notes: data.notes || {},
    text: new Map(data.books.map((b) => [b.id, b.chapters])),
  });
}

class NotFound extends Error {}
class BadRequest extends Error {}

function getTranslation(id) {
  const key = String(id || DEFAULT_TRANSLATION).toLowerCase().trim();
  const t = TRANSLATIONS.get(key);
  if (!t) {
    throw new BadRequest(`Unknown translation: ${id}. Available: ${[...TRANSLATIONS.keys()].join(', ')}`);
  }
  return t;
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

function parseTestament(testament) {
  if (!testament) return null;
  const t = String(testament).toUpperCase();
  if (t !== 'OT' && t !== 'NT') throw new BadRequest('testament must be OT or NT');
  return t;
}

function chapterText(t, b, chapter) {
  const verses = t.text.get(b.id)[chapter - 1];
  if (!verses) throw new NotFound(`${b.name} has no chapter ${chapter}`);
  return verses;
}

// Verse entries with empty text are verses a translation leaves out; they keep their number
// so references line up across translations, and carry a note explaining the gap.
function annotate(t, b, chapter, verse, obj) {
  if (obj.text === '') {
    obj.omitted = true;
    obj.note = t.notes[`${b.id} ${chapter}:${verse}`] || t.omittedNote;
  }
  return obj;
}

function verseObj(t, b, chapter, verse, text) {
  return annotate(t, b, chapter, verse, {
    translation: t.meta.id,
    book: b.name,
    bookId: b.id,
    chapter,
    verse,
    reference: `${b.name} ${chapter}:${verse}`,
    verseId: `${b.usfm}.${chapter}.${verse}`,
    text,
  });
}

function listTranslations() {
  return [...TRANSLATIONS.values()].map((t) => ({ ...t.meta, default: t.meta.id === DEFAULT_TRANSLATION }));
}

function listBooks(testament) {
  const t = parseTestament(testament);
  const text = getTranslation().text;
  return BOOKS.filter((b) => !t || b.testament === t).map((b) => ({
    number: b.number,
    id: b.id,
    usfm: b.usfm,
    name: b.name,
    slug: b.slug,
    testament: b.testament,
    chapters: text.get(b.id).length,
  }));
}

function getBook(query, translation) {
  const t = getTranslation(translation);
  const b = requireBook(query);
  const chapters = t.text.get(b.id);
  return {
    translation: t.meta.id,
    number: b.number,
    id: b.id,
    usfm: b.usfm,
    name: b.name,
    slug: b.slug,
    testament: b.testament,
    chapters: chapters.length,
    chapterList: chapters.map((v, i) => ({ chapter: i + 1, verses: v.length })),
  };
}

function getChapter(bookQuery, chapterValue, translation) {
  const t = getTranslation(translation);
  const b = requireBook(bookQuery);
  const chapter = toInt(chapterValue, 'chapter');
  return {
    translation: t.meta.id,
    book: b.name,
    bookId: b.id,
    chapter,
    reference: `${b.name} ${chapter}`,
    verses: chapterText(t, b, chapter).map((text, i) => annotate(t, b, chapter, i + 1, {
      verse: i + 1,
      verseId: `${b.usfm}.${chapter}.${i + 1}`,
      text,
    })),
  };
}

function getVerse(bookQuery, chapterValue, verseValue, translation) {
  const t = getTranslation(translation);
  const b = requireBook(bookQuery);
  const chapter = toInt(chapterValue, 'chapter');
  const verse = toInt(verseValue, 'verse');
  const text = chapterText(t, b, chapter)[verse - 1];
  if (text === undefined) throw new NotFound(`${b.name} ${chapter} has no verse ${verse} in the ${t.meta.name}`);
  return verseObj(t, b, chapter, verse, text);
}

// Parses references such as:
//   "John 3:16", "John 3:16-18", "John 3", "Gen 1-2", "Rom 8:38-9:2", "1 Cor 13:4-7"
const REF_RE = /^\s*(.+?)\s*(\d+)(?::(\d+))?(?:\s*[-–]\s*(\d+)(?::(\d+))?)?\s*$/;

function getPassage(ref, translation) {
  const t = getTranslation(translation);
  if (!ref) throw new BadRequest('Missing reference, e.g. ?ref=John 3:16-18');
  const m = REF_RE.exec(ref);
  if (!m) throw new BadRequest(`Could not parse reference: ${ref}`);
  const b = requireBook(m[1]);
  const startCh = toInt(m[2], 'chapter');
  const startV = m[3] ? toInt(m[3], 'verse') : 1;
  let endCh;
  let endV;

  if (m[4] === undefined) {
    // Single chapter or single verse.
    endCh = startCh;
    endV = m[3] ? startV : chapterText(t, b, startCh).length;
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
    endV = chapterText(t, b, endCh).length;
  }

  if (endCh < startCh || (endCh === startCh && endV < startV)) {
    throw new BadRequest(`Range end comes before start: ${ref}`);
  }

  const verses = [];
  for (let c = startCh; c <= endCh; c++) {
    const text = chapterText(t, b, c);
    const from = c === startCh ? startV : 1;
    const to = c === endCh ? endV : text.length;
    for (const v of [from, to]) {
      if (v > text.length) throw new NotFound(`${b.name} ${c} has no verse ${v} in the ${t.meta.name}`);
    }
    for (let v = from; v <= to; v++) verses.push(verseObj(t, b, c, v, text[v - 1]));
  }

  const first = verses[0];
  const last = verses[verses.length - 1];
  let reference = `${b.name} ${first.chapter}:${first.verse}`;
  if (verses.length > 1) {
    reference += last.chapter === first.chapter ? `-${last.verse}` : `-${last.chapter}:${last.verse}`;
  }
  return {
    translation: t.meta.id,
    reference,
    verses,
    text: verses.map((v) => v.text).filter(Boolean).join(' '),
  };
}

// The same passage side by side in several translations (all of them by default).
function compare(ref, translations) {
  const ids = translations
    ? String(translations).split(',').map((s) => s.trim()).filter(Boolean)
    : [...TRANSLATIONS.keys()];
  const passages = ids.map((id) => getPassage(ref, id));
  return {
    reference: passages[0].reference,
    translations: passages.map((p) => ({
      translation: p.translation,
      name: TRANSLATIONS.get(p.translation).meta.name,
      text: p.text,
      verses: p.verses.map(({ chapter, verse, text, omitted, note }) => ({ chapter, verse, text, omitted, note })),
    })),
  };
}

function search(query, { limit = 50, offset = 0, book, testament, translation } = {}) {
  const t = getTranslation(translation);
  const q = String(query || '').trim();
  if (q.length < 2) throw new BadRequest('Search query must be at least 2 characters');
  limit = Math.min(toInt(limit, 'limit'), 500);
  offset = Number(offset);
  if (!Number.isInteger(offset) || offset < 0) throw new BadRequest(`Invalid offset: ${offset}`);

  const testamentFilter = parseTestament(testament);
  let books = book ? [requireBook(book)] : BOOKS;
  if (testamentFilter) books = books.filter((b) => b.testament === testamentFilter);

  const needle = q.toLowerCase();
  const results = [];
  let total = 0;
  for (const b of books) {
    t.text.get(b.id).forEach((verses, ci) => {
      verses.forEach((text, vi) => {
        if (text.toLowerCase().includes(needle)) {
          if (total >= offset && results.length < limit) results.push(verseObj(t, b, ci + 1, vi + 1, text));
          total++;
        }
      });
    });
  }
  return { translation: t.meta.id, query: q, total, offset, limit, results };
}

function randomVerse(translation, rand = Math.random) {
  const t = getTranslation(translation);
  for (;;) {
    const b = BOOKS[Math.floor(rand() * BOOKS.length)];
    const chapters = t.text.get(b.id);
    const ci = Math.floor(rand() * chapters.length);
    const vi = Math.floor(rand() * chapters[ci].length);
    if (chapters[ci][vi] !== '') return verseObj(t, b, ci + 1, vi + 1, chapters[ci][vi]);
  }
}

function stats() {
  return {
    defaultTranslation: DEFAULT_TRANSLATION,
    translations: [...TRANSLATIONS.values()].map((t) => {
      let chapters = 0;
      let verses = 0;
      for (const c of t.text.values()) {
        chapters += c.length;
        for (const v of c) verses += v.filter(Boolean).length;
      }
      return { id: t.meta.id, name: t.meta.name, books: t.text.size, chapters, verses };
    }),
  };
}

module.exports = {
  NotFound,
  BadRequest,
  DEFAULT_TRANSLATION,
  listTranslations,
  listBooks,
  getBook,
  getChapter,
  getVerse,
  getPassage,
  compare,
  search,
  randomVerse,
  stats,
};
