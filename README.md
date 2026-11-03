# API Bible

A self-hosted REST API that serves every book, chapter and verse of the Bible
in several translations. All the text lives inside this repo (`data/`), so
there are no external services or API keys, and no dependencies beyond Node.js.

## Translations

| id | Translation | Style |
| --- | --- | --- |
| `bsb` (default) | [Berean Standard Bible](https://berean.bible) | Modern, readable English |
| `web` | [World English Bible](https://worldenglish.bible) | Modern English; uses "Yahweh" for God's name |
| `asv` | [American Standard Version](https://en.wikipedia.org/wiki/American_Standard_Version) (1901) | Formal, older English; uses "Jehovah" |

All three are public domain and complete: 66 books and 1,189 chapters each.

Add `?translation=<id>` to any endpoint to choose one. Without it you get the BSB.

## Run it

Requires Node.js 22 (18+ works locally).

```bash
npm start            # http://localhost:3000  (set PORT to change)
npm test
```

## Deploying

The repo is set up for [Vercel](https://vercel.com): `api/index.js` runs the
API as a serverless function and `vercel.json` sends every path to it. Import
the GitHub repo into Vercel (no build settings needed) and each push to `main`
redeploys it.

## Endpoints

| Method & path | What it returns |
| --- | --- |
| `GET /` | API info and totals for each translation |
| `GET /translations` | The available translations |
| `GET /books` | All 66 books (`?testament=OT` or `NT` to filter) |
| `GET /books/:book` | One book, with the verse count of each chapter |
| `GET /books/:book/chapters/:chapter` | Every verse in a chapter |
| `GET /books/:book/chapters/:chapter/verses/:verse` | A single verse |
| `GET /passage?ref=...` | A reference or range (see below) |
| `GET /compare?ref=...` | The same passage side by side in every translation (or `&translations=bsb,asv`) |
| `GET /search?q=...` | Case-insensitive text search. Optional: `limit` (max 500, default 50), `offset`, `book`, `testament` |
| `GET /random` | A random verse |

`:book` is forgiving: `John`, `john`, `1 John`, `1-john`, `1John`, `1jn`,
`I John`, `First John`, `62` (book number) and unique prefixes like `phile`
all work.

### Passage references

```
John 3:16          a single verse
John 3:16-18       a verse range
Psalm 23           a whole chapter
Genesis 1-2        a chapter range
Romans 8:38-9:2    a range across chapters
```

## Examples

```bash
curl "localhost:3000/books/john/chapters/3/verses/16?translation=web"
```

```json
{
  "translation": "web",
  "book": "John",
  "bookId": "John",
  "chapter": 3,
  "verse": 16,
  "reference": "John 3:16",
  "text": "For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life."
}
```

```bash
curl "localhost:3000/compare?ref=Psalm%2023:1"
```

```json
{
  "reference": "Psalms 23:1",
  "translations": [
    { "translation": "asv", "name": "American Standard Version", "text": "A Psalm of David. Jehovah is my shepherd; I shall not want.", "verses": [ ... ] },
    { "translation": "bsb", "name": "Berean Standard Bible", "text": "A Psalm of David. The LORD is my shepherd; I shall not want.", "verses": [ ... ] },
    { "translation": "web", "name": "World English Bible", "text": "A Psalm by David. Yahweh is my shepherd: I shall lack nothing.", "verses": [ ... ] }
  ]
}
```

```bash
curl "localhost:3000/passage?ref=Romans%208:28&translation=asv"
curl "localhost:3000/search?q=shepherd&testament=OT&limit=10"
```

Errors come back as JSON with a status code: `400` for a malformed request
or unknown translation, `404` for a book, chapter or verse that doesn't exist.

### Verses a translation leaves out

Modern translations follow the earliest manuscripts and leave out a handful of
verses found only in later ones (for example Matthew 17:21, John 5:4 and
Acts 8:37): 16 in the BSB and ASV, 4 in the WEB. Their numbers are kept so
references line up across translations; requesting one returns empty `text`
with `"omitted": true` and a `note` explaining why. They are skipped in
passage `text`, search and `/random`.

The WEB also places the closing doxology of Romans at **14:24-26** rather than
16:25-27 (as the Majority Text does); its empty 16:25 carries a note saying so.

Psalm titles ("A Psalm of David.") are part of verse 1 in every translation.

## Project layout

```
data/<id>.json           the full text of each translation
src/books.js             book names, abbreviations and lookup
src/bible.js             translation/chapter/verse/passage/search logic
src/server.js            HTTP server and routes
api/index.js             Vercel serverless entry point (with vercel.json)
scripts/import.js        rebuilds data/<id>.json from a source text
test/api.test.js         tests
```

## Data sources

| Translation | Source | Rebuild with |
| --- | --- | --- |
| BSB | [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) `formats/json/BSB.json` | `node scripts/import.js bsb BSB.json` |
| ASV | [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) `formats/json/ASV.json` | `node scripts/import.js asv ASV.json` |
| WEB | [world-english-bible](https://github.com/TehShrike/world-english-bible) npm package (`npm pack world-english-bible`) | `node scripts/import.js web <unpacked package dir>` |

The import script checks that each translation has 66 books, 1,189 chapters
and gap-free, in-order verse numbers.

### Adding another translation

Any file in `data/` is loaded automatically at startup. To add one, give
`scripts/import.js` an entry for it (metadata plus a reader for its source
format) and run it. The data format is:

```json
{
  "translation": { "id": "xyz", "name": "...", "language": "en", "license": "...", "url": "...", "description": "..." },
  "omittedNote": "Explanation shown for verses left blank",
  "notes": { "Rom 16:25": "Optional note for a specific verse" },
  "books": [{ "id": "Gen", "chapters": [["verse 1 text", "verse 2 text"]] }]
}
```

Only add translations you are allowed to redistribute; most modern
translations (NIV, ESV, NKJV, NLT, NASB, CSB, ...) are copyrighted.
