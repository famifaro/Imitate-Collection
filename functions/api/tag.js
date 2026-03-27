import {
  getTagAggregate,
  getVideoId,
  json,
  readJson,
  requireActiveUser,
  requireUser,
  unauthorized,
  badRequest,
  forbidden,
} from './_utils.js';

function readScore(body, key) {
  const value = Number(body?.[key]);
  return Number.isFinite(value) && value >= 0 && value <= 20 ? Math.round(value) : null;
}

export async function onRequestPost(context) {
  const user = await requireActiveUser(context.request, context.env);
  if (!user) {
    const loginUser = await requireUser(context.request, context.env);
    return loginUser ? forbidden('account is banned') : unauthorized();
  }

  const body = await readJson(context.request);
  const videoId = getVideoId(body?.videoId);
  const mood = readScore(body, 'mood');
  const rhythm = readScore(body, 'rhythm');
  const melody = readScore(body, 'melody');
  const origin = readScore(body, 'origin');

  if (!videoId) return badRequest('videoId is required');
  if ([mood, rhythm, melody, origin].some((v) => v === null)) {
    return badRequest('scores must be integers between 0 and 20');
  }

  await context.env.DB.prepare(
    `INSERT INTO tag_votes (video_id, user_id, mood, rhythm, melody, origin)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(video_id, user_id) DO UPDATE SET
       mood = excluded.mood,
       rhythm = excluded.rhythm,
       melody = excluded.melody,
       origin = excluded.origin,
       updated_at = CURRENT_TIMESTAMP`
  )
    .bind(videoId, user.id, mood, rhythm, melody, origin)
    .run();

  const tag = await getTagAggregate(context.env.DB, videoId);
  return json({ ok: true, videoId, tag });
}
