const SHEET_ID = '1kkVYxRtlby7KuCcAO4ATT_4ruHUoIYZRN2bDoew8T9w';
const SHEET_YEARS = [
  { year: 2018, gid: '0' },
  { year: 2019, gid: '1698956919' },
  { year: 2020, gid: '1610617513' },
  { year: 2021, gid: '642955471' },
  { year: 2022, gid: '1903730628' },
  { year: 2023, gid: '1622253645' },
  { year: 2024, gid: '1164276960' },
  { year: 2025, gid: '1309922952' },
  { year: 2026, gid: '922117181' },
];

const CACHE_KEY = 'songs_payload_v1';

function csvUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
}

function ytUrl(id) {
  return `https://www.youtube.com/watch?v=${id}`;
}

function normDate(d, year) {
  if (!d) return '';
  if (/[0-9]{4}/.test(d)) {
    return d.replace(/[年月]/g, '/').replace(/[日]/g, '').replace(/\/$/, '').trim();
  }
  const m = d.replace(/[年月]/g, '/').replace(/[日]/g, '').trim().match(/(\d+)[/](\d+)/);
  if (m) return `${year}/${String(m[1]).padStart(2, '0')}/${String(m[2]).padStart(2, '0')}`;
  return d;
}

function parseCSV(txt) {
  const rows = [];
  let row = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    const n = txt[i + 1];
    if (inQ) {
      if (c === '"' && n === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQ = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQ = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseSheet(txt, year, seen) {
  const rows = parseCSV(txt);
  if (rows.length < 2) return [];
  const C_DATE = 0;
  const C_TITLE = 2;
  const C_ARTST = 3;
  const C_BADGE = 4;
  const C_CAT = 5;
  const C_LYR = 13;

  const songs = [];
  let lastDate = '';
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((f) => !String(f || '').trim())) continue;

    const rawDate = String(r[C_DATE] || '').trim();
    if (rawDate) lastDate = rawDate;
    const date = lastDate;

    let vid = null;
    for (let ci = 0; ci < r.length; ci++) {
      const m = String(r[ci] || '').match(
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?.*?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/
      );
      if (m) {
        vid = m[1];
        break;
      }
    }
    if (!vid || seen.has(vid)) continue;
    seen.add(vid);

    songs.push({
      videoId: vid,
      title: String(r[C_TITLE] || '').trim(),
      artist: String(r[C_ARTST] || '').trim(),
      badge: String(r[C_BADGE] || '').trim(),
      url: ytUrl(vid),
      date,
      year,
      category: String(r[C_CAT] || '').trim(),
      lyrics: String(r[C_LYR] || '').trim(),
    });
  }
  return songs;
}

function finalizeSongs(all) {
  all.forEach((s) => {
    s._dn = normDate(s.date, s.year);
  });
  all.sort((a, b) => a.year - b.year || (a._dn > b._dn ? 1 : a._dn < b._dn ? -1 : 0));
  return all;
}

export async function refreshSongsCache(db) {
  const all = [];
  const seen = new Set();
  for (const { year, gid } of SHEET_YEARS) {
    const res = await fetch(csvUrl(gid));
    if (!res.ok) throw new Error(`sheet fetch failed: ${year}`);
    const txt = await res.text();
    all.push(...parseSheet(txt, year, seen));
  }
  finalizeSongs(all);
  return writeSongsCache(db, all, new Date().toISOString());
}

export async function readSongsCache(db) {
  const meta = await db
    .prepare(`SELECT payload, updated_at FROM app_cache WHERE cache_key = ?`)
    .bind(CACHE_KEY)
    .first();
  const rows = await db
    .prepare(
      `SELECT video_id, title, artist, badge, url, date, year, category, lyrics
       FROM songs_cache
       ORDER BY year, sort_date, video_id`
    )
    .all();
  if (!(rows.results || []).length) return null;
  return {
    songs: (rows.results || []).map((row) => ({
      videoId: row.video_id,
      title: row.title,
      artist: row.artist,
      badge: row.badge,
      url: row.url,
      date: row.date,
      year: row.year,
      category: row.category,
      lyrics: row.lyrics,
    })),
    updatedAt: meta?.payload || meta?.updated_at || null,
  };
}

export async function writeSongsCache(db, songs, updatedAt = new Date().toISOString()) {
  await db.prepare(`DELETE FROM songs_cache`).run();
  const statements = songs.map((song) =>
    db.prepare(
      `INSERT INTO songs_cache
       (video_id, title, artist, badge, url, date, year, category, lyrics, sort_date, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      song.videoId,
      song.title || '',
      song.artist || '',
      song.badge || '',
      song.url || ytUrl(song.videoId),
      song.date || '',
      Number(song.year || 0),
      song.category || '',
      song.lyrics || '',
      normDate(song.date || '', song.year || 0)
    )
  );
  for (let i = 0; i < statements.length; i += 100) {
    await db.batch(statements.slice(i, i + 100));
  }
  await db
    .prepare(
      `INSERT INTO app_cache (cache_key, payload, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(cache_key) DO UPDATE SET
         payload = excluded.payload,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(CACHE_KEY, updatedAt)
    .run();
  return { songs, updatedAt };
}
