/**
 * Site API: the description file.
 *
 * A JSON Schema of every answer, drawn from the same registry as the field guides and built from this league's
 * own data when the snapshot is built, so it describes the endpoints and sections this league has right now.
 * The site's address is filled in when it is handed over.
 */
import { SECTIONS, ENDPOINTS, MEANING, typeOf, ALWAYS_NULLABLE } from './apisections.js';

export const ORIGIN_MARK = '{{ORIGIN}}';

function node(v, name) {
  const d = MEANING[name];
  const t = typeOf(v);
  let o;
  if (t === 'list') o = { type: 'array', items: v.length ? node(v[0], name) : {} };
  else if (t === 'object') { o = { type: 'object', properties: {} }; for (const k of Object.keys(v)) o.properties[k] = node(v[k], k); }
  else if (t === 'number') o = { type: 'number' };
  else if (t === 'true/false') o = { type: 'boolean' };
  else if (t === 'time') o = { type: 'string', format: 'date-time' };
  else if (t === 'null') o = { type: ['number', 'string', 'null'] };
  else o = { type: 'string' };
  if (ALWAYS_NULLABLE.includes(name) && typeof o.type === 'string') o.type = [o.type, 'null'];
  if (d) o.description = d;
  return o;
}

/**
 * The schema. `values` holds each section's value; `rows` each refined endpoint's rows; `about` an about block;
 * `meta` a meta block. The address is ORIGIN_MARK until the page hands it over.
 */
export function schemaDoc({ leagueName, values, rows, about, meta }) {
  const API = `${ORIGIN_MARK}/api/v1`;
  const tooFast = { code: 'too_soon', message: 'This program asked after 12 seconds, but the site allows one round a minute. It should stop until its interval is fixed.',
    kind: 'too_fast', stop: 'exit', askEverySeconds: 60, askedAfterSeconds: 12, retryAfterSeconds: 43, docs: `${ORIGIN_MARK}/apps/site-api/#errors` };
  const defs = { meta: node(meta, 'meta'), error: node(tooFast, 'error') };
  for (const e of ENDPOINTS) {
    if (e.key === 'full') continue;
    defs[e.key + 'Row'] = node((rows[e.key] || [])[0] || {}, e.key);
  }
  const full = { type: 'object', properties: {} };
  for (const s of SECTIONS) {
    const v = s.key === 'about' ? about : values[s.key];
    full.properties[s.key] = { ...node(v == null ? [] : v, s.key), description: s.what };
  }
  defs.full = full;
  const answers = {};
  for (const e of ENDPOINTS) {
    answers[e.key + 'Answer'] = { type: 'object', required: ['ok', 'data', 'meta'], properties: { ok: { const: true },
      data: e.key === 'full' ? { $ref: '#/$defs/full' } : { type: 'array', items: { $ref: '#/$defs/' + e.key + 'Row' } }, meta: { $ref: '#/$defs/meta' } } };
  }
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema', $id: API + '/schema.json', title: `${leagueName || 'League'}: Site API, version 1`,
    description: 'Every answer of the five endpoints. Errors answer { ok: false, error }. Times are ISO 8601 in UTC; odds are fractions from 0 to 1; ids are ESPN’s own.',
    $ref: '#/$defs/any',
    $defs: { ...defs, any: { anyOf: ENDPOINTS.map((e) => ({ title: e.path, $ref: '#/$defs/' + e.key + 'Answer' })).concat([{ $ref: '#/$defs/errorAnswer' }]) },
      errorAnswer: { type: 'object', properties: { ok: { const: false }, error: { $ref: '#/$defs/error' } } }, ...answers },
  };
}
