// Stand-in, replaced by the real kit. A small JSON-schema subset validator.
// validate(schema, value) -> string[]; [] means valid.
export function validate(schema, value) {
  const errors = [];
  check(schema, value, '', errors);
  return errors;
}

function where(path) { return path || '(root)'; }

function typeOk(type, v) {
  switch (type) {
    case 'object': return v !== null && typeof v === 'object' && !Array.isArray(v);
    case 'array': return Array.isArray(v);
    case 'string': return typeof v === 'string';
    case 'integer': return Number.isInteger(v);
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'boolean': return typeof v === 'boolean';
    default: return true;
  }
}

function check(s, v, path, errors) {
  if (!s || typeof s !== 'object') return;
  if (s.type && !typeOk(s.type, v)) { errors.push(`${where(path)}: expected ${s.type}`); return; }
  if (s.enum && !s.enum.some(e => e === v)) { errors.push(`${where(path)}: ${JSON.stringify(v)} is not one of ${s.enum.join(', ')}`); return; }
  if (typeof v === 'number') {
    if (s.minimum != null && v < s.minimum) errors.push(`${where(path)}: ${v} is below the minimum ${s.minimum}`);
    if (s.maximum != null && v > s.maximum) errors.push(`${where(path)}: ${v} is above the maximum ${s.maximum}`);
  }
  if (typeof v === 'string' && s.maxLength != null && v.length > s.maxLength) errors.push(`${where(path)}: longer than ${s.maxLength} characters`);
  if (Array.isArray(v) && s.items) v.forEach((x, i) => check(s.items, x, `${path}[${i}]`, errors));
  if (typeOk('object', v)) {
    const props = s.properties ?? {};
    for (const k of s.required ?? []) if (!(k in v)) errors.push(`${where(path)}: missing field "${k}"`);
    for (const [k, x] of Object.entries(v)) {
      if (k in props) check(props[k], x, path ? `${path}.${k}` : k, errors);
      else if (s.additionalProperties === false) errors.push(`${where(path)}: unknown field "${k}"`);
    }
  }
}
