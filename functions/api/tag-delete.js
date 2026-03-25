import { badRequest, getVideoId, json, readJson } from './_utils.js';

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const videoId = getVideoId(body?.videoId);
  if (!videoId) return badRequest('videoId is required');

  await context.env.DB.batch([
    context.env.DB.prepare(`DELETE FROM adv_tag_votes WHERE video_id = ?`).bind(videoId),
    context.env.DB.prepare(`DELETE FROM tag_votes WHERE video_id = ?`).bind(videoId),
  ]);

  return json({ ok: true, videoId });
}
