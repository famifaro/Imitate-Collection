import { canModerate, ensureUserTables, json } from './_utils.js';

export async function onRequestGet(context) {
  await ensureUserTables(context.env.DB);
  const rows = await context.env.DB.prepare(
    `WITH known_user_ids AS (
      SELECT id AS user_id FROM users
      UNION
      SELECT user_id FROM tag_votes
      UNION
      SELECT user_id FROM adv_tag_votes
      UNION
      SELECT user_id FROM likes
      UNION
      SELECT user_id FROM reports WHERE user_id IS NOT NULL AND user_id != ''
      UNION
      SELECT user_id FROM login_events
      UNION
      SELECT user_id FROM page_access_events
      UNION
      SELECT user_id FROM moderator_users
      UNION
      SELECT user_id FROM banned_users
    )
    SELECT
      k.user_id AS id,
      u.discord_user_id,
      u.username,
      u.display_name,
      u.avatar_url,
      COALESCE(u.created_at, '') AS created_at,
      COALESCE(u.updated_at, '') AS updated_at,
      us.theme,
      CASE WHEN b.user_id IS NULL THEN 0 ELSE 1 END AS is_banned,
      CASE WHEN mu.user_id IS NULL THEN 0 ELSE 1 END AS is_moderator,
      b.reason AS ban_reason,
      b.created_at AS banned_at,
      (SELECT COUNT(DISTINCT video_id) FROM tag_votes WHERE user_id = k.user_id) AS tagged_videos,
      (SELECT COUNT(DISTINCT video_id) FROM likes WHERE user_id = k.user_id) AS liked_videos,
      (SELECT COUNT(*) FROM reports WHERE user_id = k.user_id) AS report_count,
      (SELECT COUNT(*) FROM login_events WHERE user_id = k.user_id) AS login_count,
      (SELECT COUNT(*) FROM page_access_events WHERE user_id = k.user_id) AS access_count,
      COALESCE(
        (SELECT MAX(created_at) FROM login_events WHERE user_id = k.user_id),
        (SELECT MAX(created_at) FROM page_access_events WHERE user_id = k.user_id),
        u.updated_at,
        u.created_at,
        ''
      ) AS last_login_at
    FROM known_user_ids k
    LEFT JOIN users u ON u.id = k.user_id
    LEFT JOIN user_settings us ON us.user_id = k.user_id
    LEFT JOIN banned_users b ON b.user_id = k.user_id
    LEFT JOIN moderator_users mu ON mu.user_id = k.user_id
    ORDER BY
      CASE WHEN b.user_id IS NULL THEN 0 ELSE 1 END DESC,
      COALESCE(
        (SELECT MAX(created_at) FROM login_events WHERE user_id = k.user_id),
        (SELECT MAX(created_at) FROM page_access_events WHERE user_id = k.user_id),
        u.updated_at,
        u.created_at,
        ''
      ) DESC,
      k.user_id ASC`
  ).all();

  const users = (rows.results || []).map((row) => ({
    id: row.id,
    discordUserId: row.discord_user_id,
    username: row.username || '',
    displayName: row.display_name || row.username || row.id,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    theme: row.theme === 'light' ? 'light' : 'dark',
    isBanned: Boolean(row.is_banned),
    banReason: row.ban_reason || '',
    bannedAt: row.banned_at || '',
    taggedVideos: Number(row.tagged_videos || 0),
    likedVideos: Number(row.liked_videos || 0),
    reportCount: Number(row.report_count || 0),
    loginCount: Number(row.login_count || 0),
    accessCount: Number(row.access_count || 0),
    lastLoginAt: row.last_login_at || '',
    canModerate:
      Boolean(row.is_moderator) ||
      canModerate({ id: row.id, discordUserId: row.discord_user_id, username: row.username }, context.env),
  }));

  return json({ ok: true, users });
}
