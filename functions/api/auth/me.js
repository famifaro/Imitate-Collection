import { getSessionUser, json } from '../_utils.js';

export async function onRequestGet(context) {
  const session = await getSessionUser(context.request, context.env);
  return json({
    ok: true,
    loggedIn: !!session,
    user: session?.user || null,
  });
}
