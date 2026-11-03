'use strict';

// USFM / Paratext book codes (used by API.Bible and many other tools), in canonical order.
const USFM = [
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH',
  'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS',
  'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL', 'MAT', 'MRK', 'LUK',
  'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT',
  'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV',
];

// Canonical list of the 66 books (Protestant canon), in order.
// id: OSIS-style identifier; aliases: extra names/abbreviations accepted in lookups.
const BOOKS = [
  ['Gen', 'Genesis', 'OT', ['gn', 'ge']],
  ['Exod', 'Exodus', 'OT', ['ex', 'exo']],
  ['Lev', 'Leviticus', 'OT', ['lv', 'le']],
  ['Num', 'Numbers', 'OT', ['nm', 'nu']],
  ['Deut', 'Deuteronomy', 'OT', ['dt', 'de']],
  ['Josh', 'Joshua', 'OT', ['jos', 'jsh']],
  ['Judg', 'Judges', 'OT', ['jdg', 'jg']],
  ['Ruth', 'Ruth', 'OT', ['rth', 'ru']],
  ['1Sam', '1 Samuel', 'OT', ['1sa', '1sm']],
  ['2Sam', '2 Samuel', 'OT', ['2sa', '2sm']],
  ['1Kgs', '1 Kings', 'OT', ['1ki', '1kg']],
  ['2Kgs', '2 Kings', 'OT', ['2ki', '2kg']],
  ['1Chr', '1 Chronicles', 'OT', ['1ch']],
  ['2Chr', '2 Chronicles', 'OT', ['2ch']],
  ['Ezra', 'Ezra', 'OT', ['ezr']],
  ['Neh', 'Nehemiah', 'OT', ['ne']],
  ['Esth', 'Esther', 'OT', ['est', 'es']],
  ['Job', 'Job', 'OT', ['jb']],
  ['Ps', 'Psalms', 'OT', ['psalm', 'psa', 'pss']],
  ['Prov', 'Proverbs', 'OT', ['pr', 'prv']],
  ['Eccl', 'Ecclesiastes', 'OT', ['ecc', 'qoh']],
  ['Song', 'Song of Solomon', 'OT', ['sos', 'song of songs', 'canticles']],
  ['Isa', 'Isaiah', 'OT', ['is']],
  ['Jer', 'Jeremiah', 'OT', ['je']],
  ['Lam', 'Lamentations', 'OT', ['la']],
  ['Ezek', 'Ezekiel', 'OT', ['eze', 'ezk']],
  ['Dan', 'Daniel', 'OT', ['da', 'dn']],
  ['Hos', 'Hosea', 'OT', ['ho']],
  ['Joel', 'Joel', 'OT', ['jl']],
  ['Amos', 'Amos', 'OT', ['am']],
  ['Obad', 'Obadiah', 'OT', ['ob']],
  ['Jonah', 'Jonah', 'OT', ['jon']],
  ['Mic', 'Micah', 'OT', ['mi']],
  ['Nah', 'Nahum', 'OT', ['na']],
  ['Hab', 'Habakkuk', 'OT', ['hb']],
  ['Zeph', 'Zephaniah', 'OT', ['zep', 'zp']],
  ['Hag', 'Haggai', 'OT', ['hg']],
  ['Zech', 'Zechariah', 'OT', ['zec', 'zc']],
  ['Mal', 'Malachi', 'OT', ['ml']],
  ['Matt', 'Matthew', 'NT', ['mt', 'mat']],
  ['Mark', 'Mark', 'NT', ['mk', 'mrk']],
  ['Luke', 'Luke', 'NT', ['lk', 'luk']],
  ['John', 'John', 'NT', ['jn', 'jhn']],
  ['Acts', 'Acts', 'NT', ['ac', 'act']],
  ['Rom', 'Romans', 'NT', ['ro', 'rm']],
  ['1Cor', '1 Corinthians', 'NT', ['1co']],
  ['2Cor', '2 Corinthians', 'NT', ['2co']],
  ['Gal', 'Galatians', 'NT', ['ga']],
  ['Eph', 'Ephesians', 'NT', ['ep']],
  ['Phil', 'Philippians', 'NT', ['php', 'pp']],
  ['Col', 'Colossians', 'NT', ['co']],
  ['1Thess', '1 Thessalonians', 'NT', ['1th', '1ts']],
  ['2Thess', '2 Thessalonians', 'NT', ['2th', '2ts']],
  ['1Tim', '1 Timothy', 'NT', ['1ti', '1tm']],
  ['2Tim', '2 Timothy', 'NT', ['2ti', '2tm']],
  ['Titus', 'Titus', 'NT', ['tit', 'ti']],
  ['Phlm', 'Philemon', 'NT', ['phm', 'philem']],
  ['Heb', 'Hebrews', 'NT', ['he']],
  ['Jas', 'James', 'NT', ['jm', 'jam']],
  ['1Pet', '1 Peter', 'NT', ['1pe', '1pt']],
  ['2Pet', '2 Peter', 'NT', ['2pe', '2pt']],
  ['1John', '1 John', 'NT', ['1jn', '1jo']],
  ['2John', '2 John', 'NT', ['2jn', '2jo']],
  ['3John', '3 John', 'NT', ['3jn', '3jo']],
  ['Jude', 'Jude', 'NT', ['jud', 'jd']],
  ['Rev', 'Revelation', 'NT', ['re', 'rv', 'revelations', 'apocalypse']],
].map(([id, name, testament, aliases], i) => ({
  number: i + 1,
  id,
  usfm: USFM[i],
  name,
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  testament,
  aliases,
}));

// Normalise a user-supplied book name: lowercase, drop dots/spaces/dashes,
// and turn leading roman numerals / ordinals ("I John", "First John") into digits.
function normalize(s) {
  let t = String(s).toLowerCase().trim().replace(/\./g, '');
  t = t.replace(/^(iii|3rd|third)\s+/, '3 ')
    .replace(/^(ii|2nd|second)\s+/, '2 ')
    .replace(/^(i|1st|first)\s+/, '1 ');
  return t.replace(/[\s_-]+/g, '');
}

const INDEX = new Map();
for (const b of BOOKS) {
  for (const key of [b.id, b.name, b.slug, String(b.number), ...b.aliases]) {
    INDEX.set(normalize(key), b);
  }
}
// USFM codes are set last so they always win over a looser alias.
for (const b of BOOKS) INDEX.set(normalize(b.usfm), b);

function findBook(query) {
  if (query == null || query === '') return null;
  const key = normalize(query);
  if (INDEX.has(key)) return INDEX.get(key);
  // Unique prefix match on the full name (e.g. "phile" -> Philemon, "gene" -> Genesis).
  const matches = BOOKS.filter((b) => normalize(b.name).startsWith(key));
  return matches.length === 1 ? matches[0] : null;
}

module.exports = { BOOKS, findBook, normalize };
