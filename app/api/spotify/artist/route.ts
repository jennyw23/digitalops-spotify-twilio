import { getSpotifyClientAccessToken } from "@/lib/spotify";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const artistId = req.nextUrl.searchParams.get("id");
  const userToken = req.nextUrl.searchParams.get("userToken");
  
  if (!artistId) {
    return NextResponse.json({ error: "Missing artist ID" }, { status: 400 });
  }

  try {
    // Use user token if provided, otherwise fall back to app credentials
    let accessToken = userToken;
    if (!accessToken) {
      accessToken = await getSpotifyClientAccessToken();
    }
    
    console.log("Fetching artist data for ID:", artistId, "with", userToken ? "user token" : "app token");
    
    // Get artist info, top tracks, and albums in parallel
    const [artistRes, topTracksRes, albumsRes] = await Promise.all([
      fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store"
      }),
      fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store"
      }),
      fetch(`https://api.spotify.com/v1/artists/${artistId}/albums?market=US&limit=10`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store"
      })
    ]);

    if (!artistRes.ok) {
      const text = await artistRes.text();
      console.error("Artist API failed:", artistRes.status, text);
      return NextResponse.json({ error: `Artist fetch failed: ${artistRes.status} - ${text}` }, { status: 500 });
    }
    
    if (!topTracksRes.ok) {
      const text = await topTracksRes.text();
      console.error("Top tracks API failed:", topTracksRes.status, text);
      return NextResponse.json({ error: `Top tracks fetch failed: ${topTracksRes.status} - ${text}` }, { status: 500 });
    }
    
    if (!albumsRes.ok) {
      const text = await albumsRes.text();
      console.error("Albums API failed:", albumsRes.status, text);
      return NextResponse.json({ error: `Albums fetch failed: ${albumsRes.status} - ${text}` }, { status: 500 });
    }

    console.log("All artist responses OK, parsing JSON...");
    const [artist, topTracks, albums] = await Promise.all([
      artistRes.json(),
      topTracksRes.json(),
      albumsRes.json()
    ]);

    console.log("Successfully fetched artist data");
    return NextResponse.json({ artist, topTracks, albums });
  } catch (e) {
    const message = e instanceof Error ? e.message : "artist_fetch_failed";
    console.error("Artist endpoint exception:", e);
    return NextResponse.json({ error: `Exception: ${message}` }, { status: 500 });
  }
}
