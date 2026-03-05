import { getSpotifyClientAccessToken, searchSpotifyTrack } from "@/lib/spotify";
import { setLatestSongRequest } from "@/lib/songStore";
import { buildTwimlMessage, validateTwilioSignature } from "@/lib/twilio";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    const signature = req.headers.get("x-twilio-signature") ?? "";
    const url = req.url;
    const formData = await req.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = String(value);
    });

    if (!validateTwilioSignature(signature, url, params, authToken)) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const formData = await req.formData();
  const body = String(formData.get("Body") ?? "").trim();
  const from = String(formData.get("From") ?? "unknown").trim();

  if (!body) {
    return new Response(buildTwimlMessage("Send a song title, e.g.: Blinding Lights by The Weeknd"), {
      headers: { "Content-Type": "application/xml" }
    });
  }

  try {
    const appAccessToken = await getSpotifyClientAccessToken();
    const track = await searchSpotifyTrack(body, appAccessToken);

    if (!track) {
      return new Response(buildTwimlMessage(`No Spotify track found for: ${body}`), {
        headers: { "Content-Type": "application/xml" }
      });
    }

    const artist = track.artists[0]?.name ?? "Unknown Artist";

    await setLatestSongRequest({
      id: randomUUID(),
      uri: track.uri,
      title: track.name,
      artist,
      query: body,
      from,
      createdAt: new Date().toISOString()
    });

    return new Response(buildTwimlMessage(`Queued: ${track.name} — ${artist}. Check the website player.`), {
      headers: { "Content-Type": "application/xml" }
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Something went wrong";
    return new Response(buildTwimlMessage(`Error processing request: ${message}`), {
      headers: { "Content-Type": "application/xml" }
    });
  }
}
