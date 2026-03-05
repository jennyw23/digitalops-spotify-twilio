import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { accessToken?: string; playlistId?: string; trackUri?: string } | null;
  const accessToken = body?.accessToken;
  const playlistId = body?.playlistId;
  const trackUri = body?.trackUri;

  if (!accessToken || !playlistId || !trackUri) {
    return NextResponse.json({ error: "accessToken, playlistId, and trackUri required" }, { status: 400 });
  }

  try {
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ uris: [trackUri] })
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: `Failed to add track: ${text}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "add_track_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
