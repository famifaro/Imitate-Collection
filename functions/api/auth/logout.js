import { clearCookie, clearSession, getSessionIdFromRequest, json } from '../_utils.js';

export async function onRequestPost(context) {
  const sessionId = getSessionIdFromRequest(context.request);
  await clearSession(context.env.DB, sessionId);
  const headers = new Headers();
  clearCookie(headers, 'ic_session');
  return json({ ok: true }, { headers });
}
