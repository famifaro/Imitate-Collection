import { badRequest, json, readJson } from '../_utils.js';
import { refreshSongsCache } from '../_sheet-cache.js';

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const token = String(body?.token || context.request.headers.get('x-admin-token') || '').trim();
  const expected = String(context.env.ADMIN_TOKEN || '').trim();

  if (!expected) return badRequest('ADMIN_TOKEN is not configured');
  if (!token || token !== expected) return json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const refreshed = await refreshSongsCache(context.env.DB);
  return json({
    ok: true,
    count: refreshed.songs.length,
    updatedAt: refreshed.updatedAt,
  });
}
