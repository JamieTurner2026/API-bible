'use strict';
// Converts a source BSB JSON file into data/bsb.json, the format the API serves.
//
// Usage: node scripts/import-bsb.js <source.json>
// Source: https://github.com/scrollmapper/bible_databases/blob/master/formats/json/BSB.json
//   { books: [{ name, chapters: [{ chapter, verses: [{ verse, text }] }] }] } in canonical order.
const fs = require('fs');
const path = require('path');
const { BOOKS } = require('../src/books');

const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/import-bsb.js <source.json>');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(src, 'utf8').replace(/^﻿/, ''));
if (raw.books.length !== BOOKS.length) throw new Error(`Expected 66 books, got ${raw.books.length}`);

const out = {
  translation: {
    id: 'bsb',
    name: 'Berean Standard Bible',
    language: 'en',
    license: 'Public Domain',
    url: 'https://berean.bible',
  },
  books: raw.books.map((b, bi) => ({
    id: BOOKS[bi].id,
    chapters: b.chapters.map((c, ci) => {
      if (c.chapter !== ci + 1) throw new Error(`${b.name}: chapter ${c.chapter} out of order`);
      return c.verses.map((v, vi) => {
        if (v.verse !== vi + 1) throw new Error(`${b.name} ${c.chapter}: verse ${v.verse} out of order`);
        return v.text.trim();
      });
    }),
  })),
};

const verses = out.books.reduce((n, b) => n + b.chapters.reduce((m, c) => m + c.length, 0), 0);
if (verses !== 31102) throw new Error(`Expected 31102 verses, got ${verses}`);

const dest = path.join(__dirname, '..', 'data', 'bsb.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`Wrote ${dest}: ${out.books.length} books, ${verses} verses`);
