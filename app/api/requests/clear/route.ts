import { clearLatestSongRequest } from "@/lib/songStore";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearLatestSongRequest();
  return NextResponse.json({ success: true });
}
