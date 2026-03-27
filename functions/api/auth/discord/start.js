import { redirect, setAuthStateCookie } from '../../_utils.js';

export async function onRequestGet(context) {
  const clientId = String(context.env.DISCORD_CLIENT_ID || '').trim();
  const redirectUri = String(context.env.DISCORD_REDIRECT_URI || '').trim();
  if (!clientId || !redirectUri) {
    return new Response('Discord auth is not configured', { status: 500 });
  }

  const state = crypto.randomUUID();
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'identify');
  url.searchParams.set('state', state);

  const headers = new Headers();
  setAuthStateCookie(headers, state);
  return redirect(url.toString(), { headers });
}
