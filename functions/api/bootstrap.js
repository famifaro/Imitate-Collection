import { getBootstrapData, getSessionUser, json } from './_utils.js';

export async function onRequestGet(context) {
  const session = await getSessionUser(context.request, context.env);
  const data = await getBootstrapData(context.env.DB, session?.user?.id || null);
  return json({
    ok: true,
    ...data,
    loggedIn: !!session,
    user: session?.user || null,
    loginRestricted: String(context.env.DISCORD_ALLOWED_USER_IDS || '').trim().length > 0,
  });
}
