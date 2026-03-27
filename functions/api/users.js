import { json } from './_utils.js';

export async function onRequestGet(context) {
  const rows = await context.env.DB.prepare(
    `SELECT
      u.id,
      u.discord_user_id,
      u.username,
      u.display_name,
      u.avatar_url,
      u.created_at,
      u.updated_at,
      CASE WHEN b.user_id IS NULL THEN 0 ELSE 1 END AS is_banned,
      b.reason AS ban_reason,
      b.created_at AS banned_at,
      (SELECT COUNT(DISTINCT video_id) FROM tag_votes WHERE user_id = u.id) AS tagged_videos,
      (SELECT COUNT(DISTINCT video_id) FROM likes WHERE user_id = u.id) AS liked_videos,
      (SELECT COUNT(*) FROM reports WHERE user_id = u.id) AS report_count,
      (SELECT COUNT(*) FROM login_events WHERE user_id = u.id) AS login_count,
      (SELECT MAX(created_at) FROM login_events WHERE user_id = u.id) AS last_login_at
    FROM users u
    LEFT JOIN banned_users b ON b.user_id = u.id
    ORDER BY u.created_at DESC`
  ).all();

  const users = (rows.results || []).map((row) => ({
    id: row.id,
    discordUserId: row.discord_user_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isBanned: Boolean(row.is_banned),
    banReason: row.ban_reason || '',
    bannedAt: row.banned_at || '',
    taggedVideos: Number(row.tagged_videos || 0),
    likedVideos: Number(row.liked_videos || 0),
    reportCount: Number(row.report_count || 0),
    loginCount: Number(row.login_count || 0),
    lastLoginAt: row.last_login_at || '',
  }));

  return json({ ok: true, users });
}
