import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const artistId = req.nextUrl.searchParams.get("id");
  const userToken = req.nextUrl.searchParams.get("userToken");
  
  if (!artistId) {
    return NextResponse.json({ error: "Missing artist ID" }, { status: 400 });
  }
  
  if (!userToken) {
    return NextResponse.json({ error: "User authentication required. Please log in with Spotify first." }, { status: 401 });
  }

  try {
    console.log("Fetching artist and albums for ID:", artistId);
    
    // Get artist info and albums
    const [artistRes, albumsRes] = await Promise.all([
      fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
        headers: { Authorization: `Bearer ${userToken}` },
        cache: "no-store"
      }),
      fetch(`https://api.spotify.com/v1/artists/${artistId}/albums?market=US&limit=1`, {
        headers: { Authorization: `Bearer ${userToken}` },
        cache: "no-store"
      })
    ]);

    if (!artistRes.ok) {
      const text = await artistRes.text();
      console.error("Artist API failed:", artistRes.status, text);
      return NextResponse.json({ error: `Artist fetch failed: ${artistRes.status} - ${text}` }, { status: 500 });
    }
    
    if (!albumsRes.ok) {
      const text = await albumsRes.text();
      console.error("Albums API failed:", albumsRes.status, text);
      return NextResponse.json({ error: `Albums fetch failed: ${albumsRes.status} - ${text}` }, { status: 500 });
    }

    const artist = await artistRes.json();
    const albumsData = await albumsRes.json();
    
    const latestAlbum = albumsData.items[0];
    
    // If we got an album, fetch its tracks
    let tracks = [];
    if (latestAlbum) {
      const tracksRes = await fetch(`https://api.spotify.com/v1/albums/${latestAlbum.id}/tracks`, {
        headers: { Authorization: `Bearer ${userToken}` },
        cache: "no-store"
      });
      
      if (tracksRes.ok) {
        const tracksData = await tracksRes.json();
        tracks = tracksData.items;
      }
    }

    console.log("Successfully fetched artist data");
    return NextResponse.json({ artist, latestAlbum, tracks });
  } catch (e) {
    const message = e instanceof Error ? e.message : "artist_fetch_failed";
    console.error("Artist endpoint exception:", e);
    return NextResponse.json({ error: `Exception: ${message}` }, { status: 500 });
  }
}
