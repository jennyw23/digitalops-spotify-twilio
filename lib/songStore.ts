import { kv } from "@vercel/kv";

export type SongRequest = {
  id: string;
  uri: string;
  title: string;
  artist: string;
  query: string;
  from: string;
  createdAt: string;
};

const SONG_KEY = "latest_song_request";
const PLAYLIST_KEY = "active_playlist_id";

declare global {
  // eslint-disable-next-line no-var
  var __latestSongRequestMemory: SongRequest | undefined;
  // eslint-disable-next-line no-var
  var __activePlaylistIdMemory: string | undefined;
}

const hasKv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

export async function setLatestSongRequest(request: SongRequest) {
  if (hasKv) {
    await kv.set(SONG_KEY, request);
    return;
  }
  global.__latestSongRequestMemory = request;
}

export async function getLatestSongRequest(): Promise<SongRequest | null> {
  if (hasKv) {
    return (await kv.get<SongRequest>(SONG_KEY)) ?? null;
  }
  return global.__latestSongRequestMemory ?? null;
}

export async function clearLatestSongRequest() {
  if (hasKv) {
    await kv.del(SONG_KEY);
    return;
  }
  global.__latestSongRequestMemory = undefined;
}

export async function setActivePlaylistId(playlistId: string | null) {
  if (hasKv) {
    if (playlistId) {
      await kv.set(PLAYLIST_KEY, playlistId);
    } else {
      await kv.del(PLAYLIST_KEY);
    }
    return;
  }
  global.__activePlaylistIdMemory = playlistId ?? undefined;
}

export async function getActivePlaylistId(): Promise<string | null> {
  if (hasKv) {
    return (await kv.get<string>(PLAYLIST_KEY)) ?? null;
  }
  return global.__activePlaylistIdMemory ?? null;
}
