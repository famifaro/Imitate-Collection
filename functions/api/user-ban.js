import {
  badRequest,
  ensureUserTables,
  forbidden,
  json,
  readJson,
  requireModerator,
  unauthorized,
} from './_utils.js';

function getUserId(value) {
  const userId = String(value || '').trim();
  return /^usr_[A-Za-z0-9]{20}$/.test(userId) ? userId : null;
}

export async function onRequestPost(context) {
  await ensureUserTables(context.env.DB);
  const user = await requireModerator(context.request, context.env);
  if (!user) {
    return context.request.headers.get('cookie') ? forbidden() : unauthorized();
  }

  const body = await readJson(context.request);
  const userId = getUserId(body?.userId);
  const banned = body?.banned !== false;
  const reason = String(body?.reason || '').trim().slice(0, 200);

  if (!userId) return badRequest('valid userId is required');

  if (banned) {
    await context.env.DB.prepare(
      `INSERT INTO banned_users (user_id, reason)
       VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET reason = excluded.reason, created_at = CURRENT_TIMESTAMP`
    )
      .bind(userId, reason)
      .run();
  } else {
    await context.env.DB.prepare(`DELETE FROM banned_users WHERE user_id = ?`).bind(userId).run();
  }

  return json({ ok: true, userId, banned, reason });
}
