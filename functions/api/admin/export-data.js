import { json } from '../_utils.js';
import { readSongsCache } from '../_sheet-cache.js';

function unauthorized() {
  return json({ ok: false, error: 'unauthorized' }, { status: 401 });
}

function hasAccess(request, env) {
  const token = String(request.headers.get('x-admin-token') || '').trim();
  const expected = String(env.ADMIN_TOKEN || '').trim();
  return expected && token === expected;
}

export async function onRequestGet(context) {
  if (!hasAccess(context.request, context.env)) return unauthorized();

  const songsCache = await readSongsCache(context.env.DB);
  const tagVotes = await context.env.DB.prepare(
    `SELECT video_id, user_id, mood, rhythm, melody, origin, created_at, updated_at
     FROM tag_votes
     ORDER BY video_id, user_id`
  ).all();
  const advTagVotes = await context.env.DB.prepare(
    `SELECT video_id, user_id, tag, selected, created_at, updated_at
     FROM adv_tag_votes
     ORDER BY video_id, user_id, tag`
  ).all();

  return json({
    ok: true,
    version: 1,
    exportedAt: new Date().toISOString(),
    songsUpdatedAt: songsCache?.updatedAt || null,
    songs: songsCache?.songs || [],
    tagVotes: tagVotes.results || [],
    advTagVotes: advTagVotes.results || [],
  });
}
