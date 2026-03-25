export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=UTF-8');
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch (e) {
    return null;
  }
}

export function badRequest(message) {
  return json({ ok: false, error: message }, { status: 400 });
}

export function getUserId(value) {
  const userId = String(value || '').trim();
  return /^[A-Za-z0-9_-]{4,64}$/.test(userId) ? userId : null;
}

export function getVideoId(value) {
  const videoId = String(value || '').trim();
  return /^[A-Za-z0-9_-]{11}$/.test(videoId) ? videoId : null;
}

function emptyTagAggregate() {
  return {
    mood: 10,
    rhythm: 10,
    melody: 10,
    origin: 10,
    votes: 0,
    adv: [],
    advVotes: {},
  };
}

export async function getTagAggregate(db, videoId) {
  const base = await db
    .prepare(
      `SELECT
        ROUND(AVG(mood)) AS mood,
        ROUND(AVG(rhythm)) AS rhythm,
        ROUND(AVG(melody)) AS melody,
        ROUND(AVG(origin)) AS origin,
        COUNT(*) AS votes
      FROM tag_votes
      WHERE video_id = ?`
    )
    .bind(videoId)
    .first();

  const tag = emptyTagAggregate();
  if (base && Number(base.votes) > 0) {
    tag.mood = Number(base.mood ?? 10);
    tag.rhythm = Number(base.rhythm ?? 10);
    tag.melody = Number(base.melody ?? 10);
    tag.origin = Number(base.origin ?? 10);
    tag.votes = Number(base.votes ?? 0);
  }

  const advRows = await db
    .prepare(
      `SELECT
        tag,
        SUM(selected) AS yes_count,
        COUNT(*) AS total_count
      FROM adv_tag_votes
      WHERE video_id = ?
      GROUP BY tag`
    )
    .bind(videoId)
    .all();

  for (const row of advRows.results || []) {
    const yes = Number(row.yes_count || 0);
    const total = Number(row.total_count || 0);
    tag.advVotes[row.tag] = { yes, total };
    if (total > 0 && yes / total >= 0.2) tag.adv.push(row.tag);
  }

  return tag;
}

export async function getBootstrapData(db, userId) {
  const tagRows = await db
    .prepare(
      `SELECT
        video_id,
        ROUND(AVG(mood)) AS mood,
        ROUND(AVG(rhythm)) AS rhythm,
        ROUND(AVG(melody)) AS melody,
        ROUND(AVG(origin)) AS origin,
        COUNT(*) AS votes
      FROM tag_votes
      GROUP BY video_id`
    )
    .all();

  const tags = {};
  for (const row of tagRows.results || []) {
    tags[row.video_id] = {
      mood: Number(row.mood ?? 10),
      rhythm: Number(row.rhythm ?? 10),
      melody: Number(row.melody ?? 10),
      origin: Number(row.origin ?? 10),
      votes: Number(row.votes ?? 0),
      adv: [],
      advVotes: {},
    };
  }

  const advRows = await db
    .prepare(
      `SELECT
        video_id,
        tag,
        SUM(selected) AS yes_count,
        COUNT(*) AS total_count
      FROM adv_tag_votes
      GROUP BY video_id, tag`
    )
    .all();

  for (const row of advRows.results || []) {
    const bucket =
      tags[row.video_id] ||
      (tags[row.video_id] = {
        mood: 10,
        rhythm: 10,
        melody: 10,
        origin: 10,
        votes: 0,
        adv: [],
        advVotes: {},
      });
    const yes = Number(row.yes_count || 0);
    const total = Number(row.total_count || 0);
    bucket.advVotes[row.tag] = { yes, total };
    if (total > 0 && yes / total >= 0.2) bucket.adv.push(row.tag);
  }

  const likeRows = await db
    .prepare(
      `SELECT video_id, COUNT(*) AS like_count
      FROM likes
      GROUP BY video_id`
    )
    .all();

  const likes = {};
  for (const row of likeRows.results || []) {
    likes[row.video_id] = Number(row.like_count || 0);
  }

  let liked = [];
  if (userId) {
    const likedRows = await db
      .prepare(`SELECT video_id FROM likes WHERE user_id = ?`)
      .bind(userId)
      .all();
    liked = (likedRows.results || []).map((row) => row.video_id);
  }

  return { tags, likes, liked };
}
