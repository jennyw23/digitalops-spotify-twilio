import { getActivePlaylistId } from "@/lib/songStore";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const playlistId = await getActivePlaylistId();
  return NextResponse.json({ playlistId });
}
