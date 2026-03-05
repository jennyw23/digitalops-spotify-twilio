import { exchangeSpotifyCode } from "@/lib/spotify";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error)}`, req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing_code", req.url));
  }

  try {
    const tokenData = await exchangeSpotifyCode(code);
    const redirectUrl = new URL("/", req.url);
    redirectUrl.searchParams.set("access_token", tokenData.access_token);
    redirectUrl.searchParams.set("refresh_token", tokenData.refresh_token);
    redirectUrl.searchParams.set("expires_in", String(tokenData.expires_in));
    return NextResponse.redirect(redirectUrl);
  } catch (e) {
    const message = e instanceof Error ? e.message : "spotify_callback_failed";
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(message)}`, req.url));
  }
}
