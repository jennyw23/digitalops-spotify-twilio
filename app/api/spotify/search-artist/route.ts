import { getSpotifyClientAccessToken } from "@/lib/spotify";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ error: "Missing query parameter q" }, { status: 400 });
  }

  try {
    const accessToken = await getSpotifyClientAccessToken();
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=1`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: "Artist search failed" }, { status: 500 });
    }

    const data = (await response.json()) as {
      artists: {
        items: Array<{
          id: string;
          name: string;
        }>;
      };
    };

    const artist = data.artists.items[0];
    if (!artist) {
      return NextResponse.json({ error: "No artist found" }, { status: 404 });
    }

    return NextResponse.json({ artistId: artist.id, artistName: artist.name });
  } catch (e) {
    const message = e instanceof Error ? e.message : "search_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
