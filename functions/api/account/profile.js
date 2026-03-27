import {
  badRequest,
  forbidden,
  json,
  requireActiveUser,
  requireUser,
  readJson,
  unauthorized,
} from '../_utils.js';

export async function onRequestPost(context) {
  const sessionUser = await requireActiveUser(context.request, context.env);
  if (!sessionUser) {
    const loginUser = await requireUser(context.request, context.env);
    return loginUser ? forbidden('account is banned') : unauthorized();
  }

  const body = await readJson(context.request);
  const displayName = String(body?.displayName || '')
    .trim()
    .slice(0, 40);
  if (!displayName) return badRequest('displayName is required');

  await context.env.DB.prepare(
    `UPDATE users
     SET display_name = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  )
    .bind(displayName, sessionUser.id)
    .run();

  return json({
    ok: true,
    user: {
      ...sessionUser,
      displayName,
    },
  });
}
