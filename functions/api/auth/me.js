import { ensureUserTables, getSessionUser, json } from '../_utils.js';

export async function onRequestGet(context) {
  await ensureUserTables(context.env.DB);
  const session = await getSessionUser(context.request, context.env);
  return json({
    ok: true,
    loggedIn: !!session,
    user: session?.user || null,
  });
}
