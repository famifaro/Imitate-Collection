import { badRequest, json, readJson } from '../_utils.js';
import { writeSongsCache } from '../_sheet-cache.js';

function unauthorized() {
  return json({ ok: false, error: 'unauthorized' }, { status: 401 });
}

function isValidVideoId(value) {
  return /^[A-Za-z0-9_-]{11}$/.test(String(value || '').trim());
}

function isValidUserId(value) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(String(value || '').trim());
}

function normalizeSong(row) {
  if (!row || typeof row !== 'object' || !isValidVideoId(row.videoId)) return null;
  const year = Number(row.year);
  return {
    videoId: String(row.videoId).trim(),
    title: String(row.title || '').trim(),
    artist: String(row.artist || '').trim(),
    badge: String(row.badge || '').trim(),
    url: String(row.url || '').trim(),
    date: String(row.date || '').trim(),
    year: Number.isFinite(year) ? year : 0,
    category: String(row.category || '').trim(),
    lyrics: String(row.lyrics || '').trim(),
  };
}

function normalizeTagVote(row) {
  if (!row || typeof row !== 'object') return null;
  if (!isValidVideoId(row.video_id) || !isValidUserId(row.user_id)) return null;
  const nums = ['mood', 'rhythm', 'melody', 'origin'].map((k) => Number(row[k]));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return {
    video_id: String(row.video_id).trim(),
    user_id: String(row.user_id).trim(),
    mood: Math.round(nums[0]),
    rhythm: Math.round(nums[1]),
    melody: Math.round(nums[2]),
    origin: Math.round(nums[3]),
    created_at: String(row.created_at || '').trim(),
    updated_at: String(row.updated_at || '').trim(),
  };
}

function normalizeAdvVote(row) {
  if (!row || typeof row !== 'object') return null;
  if (!isValidVideoId(row.video_id) || !isValidUserId(row.user_id)) return null;
  const tag = String(row.tag || '').trim();
  if (!tag) return null;
  return {
    video_id: String(row.video_id).trim(),
    user_id: String(row.user_id).trim(),
    tag,
    selected: Number(row.selected) ? 1 : 0,
    created_at: String(row.created_at || '').trim(),
    updated_at: String(row.updated_at || '').trim(),
  };
}

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const token = String(body?.token || context.request.headers.get('x-admin-token') || '').trim();
  const expected = String(context.env.ADMIN_TOKEN || '').trim();
  if (!expected || token !== expected) return unauthorized();

  const songs = Array.isArray(body?.songs) ? body.songs.map(normalizeSong).filter(Boolean) : null;
  const tagVotes = Array.isArray(body?.tagVotes)
    ? body.tagVotes.map(normalizeTagVote).filter(Boolean)
    : null;
  const advTagVotes = Array.isArray(body?.advTagVotes)
    ? body.advTagVotes.map(normalizeAdvVote).filter(Boolean)
    : null;

  if (!songs || !tagVotes || !advTagVotes) {
    return badRequest('songs, tagVotes, advTagVotes are required arrays');
  }

  await context.env.DB.batch([
    context.env.DB.prepare(`DELETE FROM adv_tag_votes`),
    context.env.DB.prepare(`DELETE FROM tag_votes`),
  ]);

  const tagStatements = tagVotes.map((row) =>
    context.env.DB.prepare(
      `INSERT INTO tag_votes (video_id, user_id, mood, rhythm, melody, origin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      row.video_id,
      row.user_id,
      row.mood,
      row.rhythm,
      row.melody,
      row.origin,
      row.created_at || new Date().toISOString(),
      row.updated_at || new Date().toISOString()
    )
  );
  for (let i = 0; i < tagStatements.length; i += 100) {
    await context.env.DB.batch(tagStatements.slice(i, i + 100));
  }

  const advStatements = advTagVotes.map((row) =>
    context.env.DB.prepare(
      `INSERT INTO adv_tag_votes (video_id, user_id, tag, selected, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      row.video_id,
      row.user_id,
      row.tag,
      row.selected,
      row.created_at || new Date().toISOString(),
      row.updated_at || new Date().toISOString()
    )
  );
  for (let i = 0; i < advStatements.length; i += 100) {
    await context.env.DB.batch(advStatements.slice(i, i + 100));
  }

  await writeSongsCache(context.env.DB, songs, String(body?.songsUpdatedAt || new Date().toISOString()));

  return json({
    ok: true,
    songs: songs.length,
    tagVotes: tagVotes.length,
    advTagVotes: advTagVotes.length,
  });
}
