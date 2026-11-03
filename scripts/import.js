'use strict';
// Builds data/<id>.json, the format the API serves, from a source text.
//
// Usage:
//   node scripts/import.js bsb <BSB.json>      scrollmapper/bible_databases formats/json/BSB.json
//   node scripts/import.js asv <ASV.json>      scrollmapper/bible_databases formats/json/ASV.json
//   node scripts/import.js web <package-dir>   the "world-english-bible" npm package (npm pack world-english-bible)
//
// Every translation is checked for 66 books, 1,189 chapters and gap-free, in-order verse numbers.
const fs = require('fs');
const path = require('path');
const { BOOKS } = require('../src/books');

const OMITTED = 'This verse is not included in this translation, which follows the earliest manuscripts; '
  + 'it appears in some later manuscripts.';

const TRANSLATIONS = {
  bsb: {
    meta: {
      id: 'bsb',
      name: 'Berean Standard Bible',
      language: 'en',
      license: 'Public Domain',
      url: 'https://berean.bible',
      description: 'A modern, readable translation based on the best available Hebrew, Aramaic and Greek manuscripts.',
    },
    read: readScrollmapper,
  },
  web: {
    meta: {
      id: 'web',
      name: 'World English Bible',
      language: 'en',
      license: 'Public Domain',
      url: 'https://worldenglish.bible',
      description: 'A modern English update of the American Standard Version, using "Yahweh" for the divine name.',
    },
    read: readWorldEnglishBiblePackage,
    notes: {
      'Rom 16:25': 'In the World English Bible this doxology appears at Romans 14:24-26.',
    },
  },
  asv: {
    meta: {
      id: 'asv',
      name: 'American Standard Version',
      language: 'en',
      license: 'Public Domain',
      url: 'https://en.wikipedia.org/wiki/American_Standard_Version',
      description: 'A formal, literal revision of the King James Version, using "Jehovah" for the divine name.',
    },
    read: readScrollmapper,
  },
};

// { books: [{ chapters: [{ chapter, verses: [{ verse, text }] }] }] } in canonical order.
function readScrollmapper(src) {
  const raw = JSON.parse(fs.readFileSync(src, 'utf8').replace(/^﻿/, ''));
  return raw.books.map((b) => b.chapters);
}

// The world-english-bible package has one file per book holding a flat list of paragraph/poetry
// fragments. Fragments of the same verse are joined, and Psalm titles (separate "header" entries)
// are put at the start of verse 1, as in the other translations. Footnote text after "*" is dropped.
function readWorldEnglishBiblePackage(dir) {
  return BOOKS.map((b) => {
    const file = path.join(dir, 'json', `${b.name.toLowerCase().replace(/\s+/g, '')}.json`);
    const chapters = new Map();
    let header = null;
    for (const item of JSON.parse(fs.readFileSync(file, 'utf8'))) {
      if (item.value === undefined) continue;
      if (item.type === 'header') {
        header = item.value.split('*')[0].trim();
        continue;
      }
      if (!chapters.has(item.chapterNumber)) chapters.set(item.chapterNumber, new Map());
      const verses = chapters.get(item.chapterNumber);
      if (!verses.has(item.verseNumber)) verses.set(item.verseNumber, []);
      if (header) verses.get(item.verseNumber).push(header);
      header = null;
      verses.get(item.verseNumber).push(item.value);
    }
    return [...chapters].sort((x, y) => x[0] - y[0]).map(([chapter, verses]) => ({
      chapter,
      verses: [...verses].sort((x, y) => x[0] - y[0])
        .map(([verse, parts]) => ({ verse, text: parts.join(' ').replace(/\s+/g, ' ').trim() })),
    }));
  });
}

const [id, src] = process.argv.slice(2);
const t = TRANSLATIONS[id];
if (!t || !src) {
  console.error(`Usage: node scripts/import.js <${Object.keys(TRANSLATIONS).join('|')}> <source>`);
  process.exit(1);
}

const books = t.read(src);
if (books.length !== BOOKS.length) throw new Error(`Expected 66 books, got ${books.length}`);

const out = {
  translation: t.meta,
  omittedNote: OMITTED,
  notes: t.notes || {},
  books: books.map((chapters, bi) => ({
    id: BOOKS[bi].id,
    chapters: chapters.map((c, ci) => {
      if (c.chapter !== ci + 1) throw new Error(`${BOOKS[bi].name}: chapter ${c.chapter} out of order`);
      return c.verses.map((v, vi) => {
        if (v.verse !== vi + 1) throw new Error(`${BOOKS[bi].name} ${c.chapter}: verse ${v.verse} out of order`);
        return v.text.trim();
      });
    }),
  })),
};

const chapters = out.books.reduce((n, b) => n + b.chapters.length, 0);
if (chapters !== 1189) throw new Error(`Expected 1189 chapters, got ${chapters}`);
const verses = out.books.reduce((n, b) => n + b.chapters.reduce((m, c) => m + c.length, 0), 0);

const dest = path.join(__dirname, '..', 'data', `${id}.json`);
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`Wrote ${dest}: ${t.meta.name}, ${out.books.length} books, ${chapters} chapters, ${verses} verses`);
