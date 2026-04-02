import {
  badRequest,
  ensureUserTables,
  forbidden,
  getVideoId,
  json,
  readJson,
  requireActiveUser,
  requireUser,
  unauthorized,
} from './_utils.js';

export async function onRequestPost(context) {
  await ensureUserTables(context.env.DB);
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
  const allowedTypes = new Set(['not_kaiwai', 'wrong_tag', 'other']);

  if (!videoId) return badRequest('videoId is required');
  if (!allowedTypes.has(type)) return badRequest('type is invalid');

  await context.env.DB.prepare(
    `INSERT INTO reports (video_id, user_id, name, contact, type, comment)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      videoId,
      user.id,
      String(user.displayName || user.username || user.id).slice(0, 120),
      contact.slice(0, 200),
      type,
      comment.slice(0, 2000)
    )
    .run();

  return json({ ok: true });
}
