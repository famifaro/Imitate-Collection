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

  if (!videoId) return badRequest('videoId is required');

  const existing = await context.env.DB.prepare(
    `SELECT 1 AS found FROM likes WHERE video_id = ? AND user_id = ?`
  )
    .bind(videoId, user.id)
    .first();

  let liked;
  if (existing) {
    await context.env.DB.prepare(`DELETE FROM likes WHERE video_id = ? AND user_id = ?`)
      .bind(videoId, user.id)
      .run();
    liked = false;
  } else {
    await context.env.DB.prepare(`INSERT INTO likes (video_id, user_id) VALUES (?, ?)`)
      .bind(videoId, user.id)
      .run();
    liked = true;
  }

  const countRow = await context.env.DB.prepare(
    `SELECT COUNT(*) AS like_count FROM likes WHERE video_id = ?`
  )
    .bind(videoId)
    .first();

  return json({
    ok: true,
    videoId,
    liked,
    likes: Number(countRow?.like_count || 0),
  });
}
