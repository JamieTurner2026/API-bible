# API Bible

A self-hosted REST API that serves every book, chapter and verse of the Bible.
All the text lives inside this repo (`data/kjv.json`), so there are no external
services or API keys, and no dependencies beyond Node.js.

- **Translation:** King James Version (public domain)
- **Coverage:** 66 books · 1,189 chapters · 31,102 verses

## Run it

Requires Node.js 18 or newer.

```bash
npm start            # http://localhost:3000  (set PORT to change)
npm test
```

## Endpoints

| Method & path | What it returns |
| --- | --- |
| `GET /` | API info and totals |
| `GET /books` | All 66 books (`?testament=OT` or `NT` to filter) |
| `GET /books/:book` | One book, with the verse count of each chapter |
| `GET /books/:book/chapters/:chapter` | Every verse in a chapter |
| `GET /books/:book/chapters/:chapter/verses/:verse` | A single verse |
| `GET /passage?ref=...` | A reference or range (see below) |
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
curl localhost:3000/books/john/chapters/3/verses/16
```

```json
{
  "book": "John",
  "bookId": "John",
  "chapter": 3,
  "verse": 16,
  "reference": "John 3:16",
  "text": "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life."
}
```

```bash
curl "localhost:3000/passage?ref=Psalm%2023:1-3"
curl "localhost:3000/search?q=shepherd&testament=OT&limit=10"
```

Errors come back as JSON with a status code: `400` for a malformed request,
`404` for a book, chapter or verse that doesn't exist.

## Project layout

```
data/kjv.json            the full Bible text
src/books.js             book names, abbreviations and lookup
src/bible.js             chapter/verse/passage/search logic
src/server.js            HTTP server and routes
scripts/import-kjv.js    rebuilds data/kjv.json from a source file
test/api.test.js         tests
```

## Data source

The KJV text was imported from
[thiagobodruk/bible](https://github.com/thiagobodruk/bible) (`json/en_kjv.json`)
with `scripts/import-kjv.js`, which checks that all 66 books and 31,102 verses
are present. To add another translation, write a file in the same format
(`{ translation, books: [{ id, chapters: [[verse, ...], ...] }] }`) and load it
in `src/bible.js`.
