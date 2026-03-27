import { json } from './_utils.js';

async function scalar(db, sql) {
  const row = await db.prepare(sql).first();
  return row ? Number(Object.values(row)[0] || 0) : 0;
}

export async function onRequestGet(context) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30).toISOString();

  const [
    usersTotal,
    bannedUsers,
    monthlyActiveUsers,
    weeklyActiveUsers,
    totalLogins,
    monthlyLogins,
    weeklyLogins,
    currentSessions,
    reportsTotal,
  ] = await Promise.all([
    scalar(context.env.DB, `SELECT COUNT(*) FROM users`),
    scalar(context.env.DB, `SELECT COUNT(*) FROM banned_users`),
    scalar(
      context.env.DB,
      `SELECT COUNT(DISTINCT user_id) FROM login_events WHERE created_at >= '${monthStart}'`
    ),
    scalar(
      context.env.DB,
      `SELECT COUNT(DISTINCT user_id) FROM login_events WHERE created_at >= '${sevenDaysAgo}'`
    ),
    scalar(context.env.DB, `SELECT COUNT(*) FROM login_events`),
    scalar(
      context.env.DB,
      `SELECT COUNT(*) FROM login_events WHERE created_at >= '${monthStart}'`
    ),
    scalar(
      context.env.DB,
      `SELECT COUNT(*) FROM login_events WHERE created_at >= '${sevenDaysAgo}'`
    ),
    scalar(
      context.env.DB,
      `SELECT COUNT(*) FROM sessions WHERE expires_at > '${new Date().toISOString()}'`
    ),
    scalar(context.env.DB, `SELECT COUNT(*) FROM reports`),
  ]);

  const dailyRows = await context.env.DB.prepare(
    `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS login_count
     FROM login_events
     WHERE created_at >= ?
     GROUP BY substr(created_at, 1, 10)
     ORDER BY day ASC`
  )
    .bind(thirtyDaysAgo)
    .all();

  const dailyActiveRows = await context.env.DB.prepare(
    `SELECT substr(created_at, 1, 10) AS day, COUNT(DISTINCT user_id) AS active_users
     FROM login_events
     WHERE created_at >= ?
     GROUP BY substr(created_at, 1, 10)
     ORDER BY day ASC`
  )
    .bind(thirtyDaysAgo)
    .all();

  const latestUsersRows = await context.env.DB.prepare(
    `SELECT id, username, display_name, created_at
     FROM users
     ORDER BY created_at DESC
     LIMIT 5`
  ).all();

  return json({
    ok: true,
    summary: {
      usersTotal,
      bannedUsers,
      monthlyActiveUsers,
      weeklyActiveUsers,
      totalLogins,
      monthlyLogins,
      weeklyLogins,
      currentSessions,
      reportsTotal,
    },
    dailyLogins: (dailyRows.results || []).map((row) => ({
      day: row.day,
      count: Number(row.login_count || 0),
    })),
    dailyActiveUsers: (dailyActiveRows.results || []).map((row) => ({
      day: row.day,
      count: Number(row.active_users || 0),
    })),
    latestUsers: (latestUsersRows.results || []).map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      createdAt: row.created_at,
    })),
  });
}
