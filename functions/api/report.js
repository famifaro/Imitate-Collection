import {
  badRequest,
  forbidden,
  getVideoId,
  json,
  readJson,
  requireActiveUser,
  requireUser,
  unauthorized,
} from './_utils.js';

export async function onRequestPost(context) {
  const user = await requireActiveUser(context.request, context.env);
  if (!user) {
    const loginUser = await requireUser(context.request, context.env);
    return loginUser ? forbidden('account is banned') : unauthorized();
  }

  const body = await readJson(context.request);
  const videoId = getVideoId(body?.videoId);
  const contact = String(body?.contact || '').trim();
  const type = String(body?.type || 'other').trim();
  const comment = String(body?.comment || '').trim();

  if (!videoId) return badRequest('videoId is required');

  await context.env.DB.prepare(
    `INSERT INTO reports (video_id, user_id, name, contact, type, comment)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(videoId, user.id, user.displayName || user.username || user.id, contact, type, comment)
    .run();

  return json({ ok: true });
}
