import { json, readJson, requireUser, ensureUserTables, recordPageAccessEvent } from './_utils.js';

export async function onRequestPost(context) {
  await ensureUserTables(context.env.DB);
  const user = await requireUser(context.request, context.env);
  if (!user) return json({ ok: true, logged: false });

  const body = await readJson(context.request);
  const path = String(body?.path || new URL(context.request.url).pathname || '/').trim() || '/';
  await recordPageAccessEvent(context.env.DB, user.id, path);
  return json({ ok: true, logged: true });
}
