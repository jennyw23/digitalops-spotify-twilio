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

declare global {
  // eslint-disable-next-line no-var
  var __latestSongRequestMemory: SongRequest | undefined;
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
