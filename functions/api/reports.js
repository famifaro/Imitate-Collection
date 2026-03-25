import { json } from './_utils.js';

export async function onRequestGet(context) {
  const rows = await context.env.DB.prepare(
    `SELECT id, video_id, name, contact, type, comment, resolved, created_at
     FROM reports
     ORDER BY created_at DESC, id DESC`
  ).all();

  const reports = (rows.results || []).map((row) => ({
    id: Number(row.id),
    vid: row.video_id,
    name: row.name,
    contact: row.contact,
    type: row.type,
    comment: row.comment,
    resolved: Boolean(row.resolved),
    ts: row.created_at,
  }));

  return json({ ok: true, reports });
}
