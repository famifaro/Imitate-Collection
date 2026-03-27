import {
  badRequest,
  forbidden,
  json,
  ensureUserTables,
  requireActiveUser,
  requireUser,
  readJson,
  unauthorized,
  upsertUserSettings,
} from '../_utils.js';

export async function onRequestPost(context) {
  await ensureUserTables(context.env.DB);
  const sessionUser = await requireActiveUser(context.request, context.env);
  if (!sessionUser) {
    const loginUser = await requireUser(context.request, context.env);
    return loginUser ? forbidden('account is banned') : unauthorized();
  }

  const body = await readJson(context.request);
  const displayName = String(body?.displayName || '')
    .trim()
    .slice(0, 40);
  const theme = body?.theme === 'light' ? 'light' : 'dark';
  if (!displayName) return badRequest('displayName is required');

  await context.env.DB.prepare(
    `UPDATE users
     SET display_name = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  )
    .bind(displayName, sessionUser.id)
    .run();
  await upsertUserSettings(context.env.DB, sessionUser.id, { theme });

  return json({
    ok: true,
    user: {
      ...sessionUser,
      displayName,
      theme,
    },
  });
}
