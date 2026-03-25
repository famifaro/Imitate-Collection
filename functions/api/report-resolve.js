import { badRequest, json, readJson } from './_utils.js';

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) return badRequest('id is required');

  await context.env.DB.prepare(`UPDATE reports SET resolved = 1 WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}
