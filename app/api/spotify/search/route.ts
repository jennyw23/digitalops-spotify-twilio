import { getSpotifyClientAccessToken, searchSpotifyTrack } from "@/lib/spotify";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ error: "Missing query parameter q" }, { status: 400 });
  }

  try {
    const accessToken = await getSpotifyClientAccessToken();
    const track = await searchSpotifyTrack(query, accessToken);
    return NextResponse.json({ track });
  } catch (e) {
    const message = e instanceof Error ? e.message : "spotify_search_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
