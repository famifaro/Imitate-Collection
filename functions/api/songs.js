import { json } from './_utils.js';
import { readSongsCache, refreshSongsCache } from './_sheet-cache.js';

export async function onRequestGet(context) {
  let cached = await readSongsCache(context.env.DB);
  if (!cached || !cached.songs.length) {
    cached = await refreshSongsCache(context.env.DB);
  }
  return json({ ok: true, songs: cached.songs, updatedAt: cached.updatedAt });
}
