import {
  badRequest,
  ensureUserTables,
  forbidden,
  json,
  readJson,
  requireModerator,
  unauthorized,
} from './_utils.js';

function getAppUserId(value) {
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
  const userId = getAppUserId(body?.userId);
  const moderator = body?.moderator !== false;

  if (!userId) return badRequest('valid userId is required');

  if (moderator) {
    await context.env.DB.prepare(
      `INSERT INTO moderator_users (user_id)
       VALUES (?)
       ON CONFLICT(user_id) DO NOTHING`
    )
      .bind(userId)
      .run();
  } else {
    await context.env.DB.prepare(`DELETE FROM moderator_users WHERE user_id = ?`).bind(userId).run();
  }

  return json({ ok: true, userId, moderator });
}
