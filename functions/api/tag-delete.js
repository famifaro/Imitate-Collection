import {
  badRequest,
  ensureUserTables,
  forbidden,
  getVideoId,
  json,
  readJson,
  requireModerator,
  unauthorized,
} from './_utils.js';

export async function onRequestPost(context) {
  await ensureUserTables(context.env.DB);
  const user = await requireModerator(context.request, context.env);
  if (!user) {
    return context.request.headers.get('cookie') ? forbidden() : unauthorized();
  }

  const body = await readJson(context.request);
  const videoId = getVideoId(body?.videoId);
  if (!videoId) return badRequest('videoId is required');

  await context.env.DB.batch([
    context.env.DB.prepare(`DELETE FROM adv_tag_votes WHERE video_id = ?`).bind(videoId),
    context.env.DB.prepare(`DELETE FROM tag_votes WHERE video_id = ?`).bind(videoId),
  ]);

  return json({ ok: true, videoId });
}
