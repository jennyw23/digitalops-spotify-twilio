import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { accessToken?: string; name?: string; description?: string } | null;
  const accessToken = body?.accessToken;
  const name = body?.name || "WhatsApp Song Requests";
  const description = body?.description || "Songs requested via WhatsApp";

  if (!accessToken) {
    return NextResponse.json({ error: "accessToken required" }, { status: 400 });
  }

  try {
    // Get current user ID
    const userResponse = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!userResponse.ok) {
      return NextResponse.json({ error: "Failed to get user info" }, { status: 500 });
    }

    const user = (await userResponse.json()) as { id: string };

    // Create playlist
    const playlistResponse = await fetch(`https://api.spotify.com/v1/users/${user.id}/playlists`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        description,
        public: false
      })
    });

    if (!playlistResponse.ok) {
      return NextResponse.json({ error: "Failed to create playlist" }, { status: 500 });
    }

    const playlist = (await playlistResponse.json()) as { id: string; name: string; external_urls: { spotify: string } };
    return NextResponse.json({ playlistId: playlist.id, name: playlist.name, url: playlist.external_urls.spotify });
  } catch (e) {
    const message = e instanceof Error ? e.message : "playlist_create_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
