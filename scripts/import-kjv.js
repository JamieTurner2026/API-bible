'use strict';
// Converts a source KJV JSON file into data/kjv.json, the format the API serves.
//
// Usage: node scripts/import-kjv.js <source.json>
// Source format: [{ name, chapters: [[verseText, ...], ...] }, ...] in canonical order
// (e.g. https://github.com/thiagobodruk/bible/blob/master/json/en_kjv.json).
const fs = require('fs');
const path = require('path');
const { BOOKS } = require('../src/books');

const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/import-kjv.js <source.json>');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(src, 'utf8').replace(/^﻿/, ''));
if (raw.length !== BOOKS.length) throw new Error(`Expected 66 books, got ${raw.length}`);

const out = {
  translation: { id: 'kjv', name: 'King James Version', language: 'en', license: 'Public Domain' },
  books: raw.map((b, i) => {
    if (b.name !== BOOKS[i].name) throw new Error(`Book ${i + 1}: expected ${BOOKS[i].name}, got ${b.name}`);
    return { id: BOOKS[i].id, chapters: b.chapters.map((ch) => ch.map((v) => v.trim())) };
  }),
};

const verses = out.books.reduce((n, b) => n + b.chapters.reduce((m, c) => m + c.length, 0), 0);
if (verses !== 31102) throw new Error(`Expected 31102 verses, got ${verses}`);

const dest = path.join(__dirname, '..', 'data', 'kjv.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`Wrote ${dest}: ${out.books.length} books, ${verses} verses`);
