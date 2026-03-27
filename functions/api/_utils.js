export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=UTF-8');
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

const SESSION_COOKIE = 'ic_session';
const AUTH_STATE_COOKIE = 'ic_auth_state';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const AUTH_STATE_TTL_MS = 1000 * 60 * 10;

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

export function unauthorized(message = 'login required') {
  return json({ ok: false, error: message }, { status: 401 });
}

export function forbidden(message = 'forbidden') {
  return json({ ok: false, error: message }, { status: 403 });
}

export function redirect(location, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('location', location);
  return new Response(null, {
    ...init,
    status: init.status || 302,
    headers,
  });
}

export function getUserId(value) {
  const userId = String(value || '').trim();
  return /^[A-Za-z0-9_-]{4,64}$/.test(userId) ? userId : null;
}

export function getVideoId(value) {
  const videoId = String(value || '').trim();
  return /^[A-Za-z0-9_-]{11}$/.test(videoId) ? videoId : null;
}

export function makeAppUserId() {
  return `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

function getCookieMap(request) {
  const cookie = request.headers.get('cookie') || '';
  const pairs = cookie.split(/;\s*/).filter(Boolean);
  const map = new Map();
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    map.set(key, decodeURIComponent(value));
  }
  return map;
}

function makeExpires(ms) {
  return new Date(ms).toUTCString();
}

export function appendCookie(headers, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax'];
  if (options.expires) parts.push(`Expires=${options.expires}`);
  if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
  headers.append('Set-Cookie', parts.join('; '));
}

export function clearCookie(headers, name) {
  appendCookie(headers, name, '', { expires: 'Thu, 01 Jan 1970 00:00:00 GMT', maxAge: 0 });
}

export function getSessionIdFromRequest(request) {
  return getCookieMap(request).get(SESSION_COOKIE) || null;
}

export function getAuthStateFromRequest(request) {
  return getCookieMap(request).get(AUTH_STATE_COOKIE) || null;
}

export function setAuthStateCookie(headers, state) {
  appendCookie(headers, AUTH_STATE_COOKIE, state, {
    expires: makeExpires(Date.now() + AUTH_STATE_TTL_MS),
    maxAge: Math.floor(AUTH_STATE_TTL_MS / 1000),
  });
}

export function clearAuthStateCookie(headers) {
  clearCookie(headers, AUTH_STATE_COOKIE);
}

export async function createSession(db, userId) {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await db.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`)
    .bind(sessionId, userId, expiresAt)
    .run();
  return { sessionId, expiresAt };
}

export async function recordLogin(db, userId) {
  await db.prepare(`INSERT INTO login_events (user_id) VALUES (?)`).bind(userId).run();
}

export function setSessionCookie(headers, sessionId, expiresAt) {
  appendCookie(headers, SESSION_COOKIE, sessionId, {
    expires: makeExpires(Date.parse(expiresAt)),
    maxAge: Math.floor((Date.parse(expiresAt) - Date.now()) / 1000),
  });
}

export async function clearSession(db, sessionId) {
  if (!sessionId) return;
  await db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
}

export async function getSessionUser(request, env) {
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) return null;

  const row = await env.DB.prepare(
    `SELECT
      s.id AS session_id,
      s.expires_at,
      u.id,
      u.discord_user_id,
      u.username,
      u.display_name,
      u.avatar_url,
      u.created_at,
      u.updated_at,
      CASE WHEN b.user_id IS NULL THEN 0 ELSE 1 END AS is_banned
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN banned_users b ON b.user_id = u.id
    WHERE s.id = ?`
  )
    .bind(sessionId)
    .first();

  if (!row) return null;
  if (Date.parse(String(row.expires_at || '')) <= Date.now()) {
    await clearSession(env.DB, sessionId);
    return null;
  }

  return {
    sessionId,
    user: {
      id: row.id,
      discordUserId: row.discord_user_id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isBanned: Boolean(row.is_banned),
    },
  };
}

export async function requireUser(request, env) {
  const session = await getSessionUser(request, env);
  return session?.user || null;
}

export async function requireActiveUser(request, env) {
  const user = await requireUser(request, env);
  if (!user || user.isBanned) return null;
  return user;
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
  let myTagVotes = {};
  let myAdvTags = {};
  if (userId) {
    const likedRows = await db
      .prepare(`SELECT video_id FROM likes WHERE user_id = ?`)
      .bind(userId)
      .all();
    liked = (likedRows.results || []).map((row) => row.video_id);

    const myTagRows = await db
      .prepare(
        `SELECT video_id, mood, rhythm, melody, origin
         FROM tag_votes
         WHERE user_id = ?`
      )
      .bind(userId)
      .all();
    for (const row of myTagRows.results || []) {
      myTagVotes[row.video_id] = {
        mood: Number(row.mood ?? 10),
        rhythm: Number(row.rhythm ?? 10),
        melody: Number(row.melody ?? 10),
        origin: Number(row.origin ?? 10),
      };
    }

    const myAdvRows = await db
      .prepare(
        `SELECT video_id, tag
         FROM adv_tag_votes
         WHERE user_id = ? AND selected = 1`
      )
      .bind(userId)
      .all();
    for (const row of myAdvRows.results || []) {
      if (!myAdvTags[row.video_id]) myAdvTags[row.video_id] = [];
      myAdvTags[row.video_id].push(row.tag);
    }
  }

  return { tags, likes, liked, myTagVotes, myAdvTags };
}
