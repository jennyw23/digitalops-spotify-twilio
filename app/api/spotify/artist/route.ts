import { getSpotifyClientAccessToken } from "@/lib/spotify";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const artistId = req.nextUrl.searchParams.get("id");
  if (!artistId) {
    return NextResponse.json({ error: "Missing artist ID" }, { status: 400 });
  }

  try {
    const accessToken = await getSpotifyClientAccessToken();
    
    // Get artist info, top tracks, and albums in parallel
    const [artistRes, topTracksRes, albumsRes] = await Promise.all([
      fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      }),
      fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      }),
      fetch(`https://api.spotify.com/v1/artists/${artistId}/albums?market=US&limit=10`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
    ]);

    if (!artistRes.ok || !topTracksRes.ok || !albumsRes.ok) {
      return NextResponse.json({ error: "Failed to fetch artist data" }, { status: 500 });
    }

    const [artist, topTracks, albums] = await Promise.all([
      artistRes.json(),
      topTracksRes.json(),
      albumsRes.json()
    ]);

    return NextResponse.json({ artist, topTracks, albums });
  } catch (e) {
    const message = e instanceof Error ? e.message : "artist_fetch_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
