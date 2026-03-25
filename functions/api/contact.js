import { badRequest, json, readJson } from './_utils.js';

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const name = String(body?.name || '').trim();
  const addr = String(body?.addr || '').trim();
  const type = String(body?.type || 'other').trim();
  const bodyText = String(body?.body || '').trim();

  if (!bodyText) return badRequest('body is required');

  await context.env.DB.prepare(
    `INSERT INTO contacts (name, addr, type, body)
     VALUES (?, ?, ?, ?)`
  )
    .bind(name, addr, type, bodyText)
    .run();

  return json({ ok: true });
}
