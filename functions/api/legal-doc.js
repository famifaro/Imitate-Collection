import { badRequest, json, readJson } from './_utils.js';

const DOC_KEYS = {
  tos: 'legal_tos_html',
  privacy: 'legal_privacy_html',
};

function normalizeKey(value) {
  const key = String(value || '').trim();
  return DOC_KEYS[key] ? key : null;
}

async function readDoc(db, key) {
  const row = await db
    .prepare(`SELECT payload, updated_at FROM app_cache WHERE cache_key = ?`)
    .bind(DOC_KEYS[key])
    .first();
  return {
    content: String(row?.payload || ''),
    updatedAt: row?.updated_at || '',
  };
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const key = normalizeKey(url.searchParams.get('key'));
  if (!key) return badRequest('invalid key');
  const data = await readDoc(context.env.DB, key);
  return json({ ok: true, key, ...data });
}

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const key = normalizeKey(body?.key);
  if (!key) return badRequest('invalid key');

  const token = String(body?.token || context.request.headers.get('x-admin-token') || '').trim();
  const expected = String(context.env.ADMIN_TOKEN || '').trim();
  if (!expected) return badRequest('ADMIN_TOKEN is not configured');
  if (!token || token !== expected) return json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const content = String(body?.content || '');
  await context.env.DB
    .prepare(
      `INSERT INTO app_cache (cache_key, payload, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(cache_key) DO UPDATE SET
         payload = excluded.payload,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(DOC_KEYS[key], content)
    .run();

  const saved = await readDoc(context.env.DB, key);
  return json({ ok: true, key, ...saved });
}
