import {
  badRequest,
  getTagAggregate,
  getUserId,
  getVideoId,
  json,
  readJson,
} from './_utils.js';

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const userId = getUserId(body?.userId);
  const videoId = getVideoId(body?.videoId);
  const tags = Array.isArray(body?.tags)
    ? [...new Set(body.tags.map((v) => String(v || '').trim()).filter(Boolean))]
    : null;

  if (!userId || !videoId) return badRequest('userId and videoId are required');
  if (!tags) return badRequest('tags must be an array');

  const tx = [];
  tx.push(
    context.env.DB.prepare(`DELETE FROM adv_tag_votes WHERE video_id = ? AND user_id = ?`).bind(
      videoId,
      userId
    )
  );
  for (const tag of tags) {
    tx.push(
      context.env.DB.prepare(
        `INSERT INTO adv_tag_votes (video_id, user_id, tag, selected)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(video_id, user_id, tag) DO UPDATE SET
           selected = 1,
           updated_at = CURRENT_TIMESTAMP`
      ).bind(videoId, userId, tag)
    );
  }
  await context.env.DB.batch(tx);

  const aggregate = await getTagAggregate(context.env.DB, videoId);
  return json({ ok: true, videoId, tag: aggregate });
}
