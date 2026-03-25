import { badRequest, getBootstrapData, getUserId, json } from './_utils.js';

export async function onRequestGet(context) {
  const userId = getUserId(new URL(context.request.url).searchParams.get('userId'));
  if (!userId) return badRequest('userId is required');

  const data = await getBootstrapData(context.env.DB, userId);
  return json({ ok: true, ...data });
}
