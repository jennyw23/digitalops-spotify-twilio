import { refreshSpotifyToken } from "@/lib/spotify";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { refreshToken?: string } | null;
  const refreshToken = body?.refreshToken;

  if (!refreshToken) {
    return NextResponse.json({ error: "refreshToken required" }, { status: 400 });
  }

  try {
    const tokenData = await refreshSpotifyToken(refreshToken);
    return NextResponse.json(tokenData);
  } catch (e) {
    const message = e instanceof Error ? e.message : "token_refresh_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
