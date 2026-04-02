import {
  badRequest,
  ensureUserTables,
  forbidden,
  json,
  readJson,
  requireModerator,
  unauthorized,
} from './_utils.js';

export async function onRequestPost(context) {
  await ensureUserTables(context.env.DB);
  const user = await requireModerator(context.request, context.env);
  if (!user) {
    return context.request.headers.get('cookie') ? forbidden() : unauthorized();
  }

  const body = await readJson(context.request);
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) return badRequest('id is required');

  await context.env.DB.prepare(`UPDATE reports SET resolved = 1 WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}
