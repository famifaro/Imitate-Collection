import { badRequest, getUserId, getVideoId, json, readJson } from './_utils.js';

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const userId = getUserId(body?.userId);
  const videoId = getVideoId(body?.videoId);

  if (!userId || !videoId) return badRequest('userId and videoId are required');

  const existing = await context.env.DB.prepare(
    `SELECT 1 AS found FROM likes WHERE video_id = ? AND user_id = ?`
  )
    .bind(videoId, userId)
    .first();

  let liked;
  if (existing) {
    await context.env.DB.prepare(`DELETE FROM likes WHERE video_id = ? AND user_id = ?`)
      .bind(videoId, userId)
      .run();
    liked = false;
  } else {
    await context.env.DB.prepare(`INSERT INTO likes (video_id, user_id) VALUES (?, ?)`)
      .bind(videoId, userId)
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
