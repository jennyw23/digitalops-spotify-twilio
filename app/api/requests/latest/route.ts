import { getLatestSongRequest } from "@/lib/songStore";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const request = await getLatestSongRequest();
  return NextResponse.json({ request });
}
