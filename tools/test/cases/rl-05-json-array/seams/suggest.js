// Suggest the next book for each child from what they have logged.
// Pure: no network, storage, window or document. The screen does the model call.
//
// historyFor(readers, entries) -> [{reader, read: [{title, kind}]}]
//   One item per reader, in readers order. read lists that reader's logged titles,
//   newest first, each title once (case-insensitive).
//
// suggestionMessages(history) -> messages for call('suggest', messages)
//   Asks for a JSON array: one {reader, title, reason} per child.
//
// checkSuggestions(text, schema, readers, entries) -> {suggestions, errors}
//   Parses the model's text and checks it against the schema (data/schema/suggestions.json).
//   suggestions: the items that pass, name a known reader, are not a title that reader
//   has already logged, and are the first suggestion for that reader.
//   errors: one line per item or answer that was left out; [] when all is well.

import { validate } from '../kit/gate.js';

const norm = t => String(t).trim().toLowerCase();

export function historyFor(readers, entries) {
  const newestFirst = [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return readers.map(r => {
    const seen = new Set();
    const read = [];
    for (const e of newestFirst) {
      if (e.reader !== r.name || seen.has(norm(e.title))) continue;
      seen.add(norm(e.title));
      read.push({ title: e.title.trim(), kind: e.kind });
    }
    return { reader: r.name, read };
  });
}

export function suggestionMessages(history) {
  return [
    {
      role: 'system',
      content:
        'You suggest the next book for each child in a family reading log. ' +
        'Reply with only a JSON array, no other text. Each item is {"reader": name, "title": book title, "reason": one short sentence}. ' +
        'Give exactly one item per child, and use each child\'s name exactly as given. ' +
        'Never suggest a title the child has already read. ' +
        'For a child with an empty "read" list, suggest a well-loved book for a young reader.',
    },
    { role: 'user', content: JSON.stringify(history) },
  ];
}

export function checkSuggestions(text, schema, readers, entries) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { return { suggestions: [], errors: ['the answer was not JSON'] }; }
  const schemaErrors = validate(schema, parsed);
  if (schemaErrors.length) return { suggestions: [], errors: schemaErrors };

  const known = new Set(readers.map(r => r.name));
  const logged = new Map();
  for (const e of entries) {
    if (!logged.has(e.reader)) logged.set(e.reader, new Set());
    logged.get(e.reader).add(norm(e.title));
  }

  const suggestions = [];
  const errors = [];
  const givenTo = new Set();
  for (const s of parsed) {
    if (!known.has(s.reader)) { errors.push(`unknown reader "${s.reader}"`); continue; }
    if (givenTo.has(s.reader)) { errors.push(`more than one suggestion for ${s.reader}`); continue; }
    if (logged.get(s.reader)?.has(norm(s.title))) { errors.push(`${s.reader} has already read "${s.title}"`); continue; }
    givenTo.add(s.reader);
    suggestions.push(s);
  }
  return { suggestions, errors };
}
