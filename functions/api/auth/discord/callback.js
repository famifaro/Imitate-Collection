import {
  clearAuthStateCookie,
  createSession,
  ensureUserTables,
  isDiscordLoginAllowed,
  makeAppUserId,
  recordLogin,
  redirect,
  getAuthStateFromRequest,
  setSessionCookie,
  upsertUserSettings,
} from '../../_utils.js';

function discordAvatarUrl(user) {
  if (!user?.id || !user?.avatar) return '';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`;
}

function pickDisplayName(user) {
  return String(user?.global_name || user?.username || 'Discord User').trim().slice(0, 40);
}

async function exchangeCodeForToken(code, env) {
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.DISCORD_REDIRECT_URI,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  return res.json();
}

async function fetchDiscordUser(accessToken) {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`user fetch failed: ${res.status}`);
  return res.json();
}

export async function onRequestGet(context) {
  await ensureUserTables(context.env.DB);
  const url = new URL(context.request.url);
  const code = String(url.searchParams.get('code') || '').trim();
  const state = String(url.searchParams.get('state') || '').trim();
  const savedState = getAuthStateFromRequest(context.request);

  if (!code || !state || !savedState || state !== savedState) {
    const headers = new Headers();
    clearAuthStateCookie(headers);
    return redirect('/?authError=state_mismatch', { headers });
  }

  try {
    const token = await exchangeCodeForToken(code, context.env);
    const discordUser = await fetchDiscordUser(token.access_token);
    const discordUserId = String(discordUser.id || '').trim();
    if (!discordUserId) throw new Error('discord user id missing');
    if (!isDiscordLoginAllowed(discordUserId, context.env)) {
      const headers = new Headers();
      clearAuthStateCookie(headers);
      return redirect('/?authError=login_not_allowed', { headers });
    }

    let user = await context.env.DB.prepare(
      `SELECT id, display_name FROM users WHERE discord_user_id = ?`
    )
      .bind(discordUserId)
      .first();

    const username = String(discordUser.username || '').trim().slice(0, 40);
    const displayName = pickDisplayName(discordUser);
    const avatarUrl = discordAvatarUrl(discordUser);

    if (!user) {
      const userId = makeAppUserId();
      await context.env.DB.prepare(
        `INSERT INTO users (id, discord_user_id, username, display_name, avatar_url)
         VALUES (?, ?, ?, ?, ?)`
      )
        .bind(userId, discordUserId, username, displayName, avatarUrl)
        .run();
      user = { id: userId };
    } else {
      await context.env.DB.prepare(
        `UPDATE users
         SET username = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
        .bind(username, avatarUrl, user.id)
        .run();
    }

    await upsertUserSettings(context.env.DB, user.id, { theme: 'dark' });
    const { sessionId, expiresAt } = await createSession(context.env.DB, user.id);
    await recordLogin(context.env.DB, user.id);
    const headers = new Headers();
    clearAuthStateCookie(headers);
    setSessionCookie(headers, sessionId, expiresAt);
    return redirect('/', { headers });
  } catch (error) {
    const headers = new Headers();
    clearAuthStateCookie(headers);
    return redirect('/?authError=discord_login_failed', { headers });
  }
}
