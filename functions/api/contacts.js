import { ensureUserTables, forbidden, json, requireModerator, unauthorized } from './_utils.js';

export async function onRequestGet(context) {
  await ensureUserTables(context.env.DB);
  const user = await requireModerator(context.request, context.env);
  if (!user) {
    return context.request.headers.get('cookie') ? forbidden() : unauthorized();
  }

  const rows = await context.env.DB.prepare(
    `SELECT id, name, addr, type, body, created_at
     FROM contacts
     ORDER BY created_at DESC, id DESC`
  ).all();

  return json({
    ok: true,
    contacts: (rows.results || []).map((row) => ({
      id: Number(row.id),
      name: row.name || '',
      addr: row.addr || '',
      type: row.type || 'other',
      body: row.body || '',
      createdAt: row.created_at || '',
    })),
  });
}
