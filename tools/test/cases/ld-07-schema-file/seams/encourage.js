// Seam: the encouraging words said after each game. Pure: no network, storage or globals.

/** Contract: (levelName: string, score: integer >= 0) -> messages for call('encourage', messages). */
export function encouragementMessages(levelName, score) {
  return [
    { role: 'system', content: 'You cheer on a child after a short letter-catching game. Reply with JSON only, in the form {"message": "..."}. The message is one warm, encouraging sentence of at most 120 characters. Do not scold, and do not compare the child to anyone.' },
    { role: 'user', content: `Level: ${levelName}. Score: ${score}.` },
  ];
}

/** Contract: (text: string from the model) -> the message string, or null when the text is not JSON with a "message" string. */
export function readEncouragement(text) {
  try {
    const v = JSON.parse(text);
    return v && typeof v.message === 'string' ? v.message : null;
  } catch {
    return null;
  }
}

/** Contract: (score: integer >= 0) -> string. Used when no model answers. */
export function fallbackEncouragement(score) {
  return score > 0 ? 'Nice work, keep going!' : 'Good try, you will get the next one!';
}
