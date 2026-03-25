import { badRequest, getVideoId, json, readJson } from './_utils.js';

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const videoId = getVideoId(body?.videoId);
  const name = String(body?.name || '').trim();
  const contact = String(body?.contact || '').trim();
  const type = String(body?.type || 'other').trim();
  const comment = String(body?.comment || '').trim();

  if (!videoId || !name) return badRequest('videoId and name are required');

  await context.env.DB.prepare(
    `INSERT INTO reports (video_id, name, contact, type, comment)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(videoId, name, contact, type, comment)
    .run();

  return json({ ok: true });
}
