import { setActivePlaylistId } from "@/lib/songStore";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { playlistId?: string | null } | null;
  const playlistId = body?.playlistId ?? null;

  await setActivePlaylistId(playlistId);
  return NextResponse.json({ success: true });
}
