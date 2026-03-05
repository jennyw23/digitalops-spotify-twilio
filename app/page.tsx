"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TokenState = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

type SongRequest = {
  id: string;
  uri: string;
  title: string;
  artist: string;
  query: string;
  from: string;
  createdAt: string;
};

const STORAGE_KEY = "spotify_token_state";

export default function HomePage() {
  const [tokenState, setTokenState] = useState<TokenState | null>(null);
  const [deviceId, setDeviceId] = useState<string>("");
  const [latestRequest, setLatestRequest] = useState<SongRequest | null>(null);
  const [status, setStatus] = useState<string>("Not connected");
  const [sdkReady, setSdkReady] = useState(false);
  const [isPlayingRequest, setIsPlayingRequest] = useState(false);

  const playerRef = useRef<SpotifyPlayer | null>(null);
  const lastPlayedRequestIdRef = useRef<string>("");

  const spotifyAuthUrl = useMemo(() => {
    const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
    const redirectUri = `${siteUrl}/api/spotify/callback`;
    const scopes = [
      "streaming",
      "user-read-email",
      "user-read-private",
      "user-read-playback-state",
      "user-modify-playback-state"
    ];
    const params = new URLSearchParams({
      client_id: clientId ?? "",
      response_type: "code",
      redirect_uri: redirectUri,
      scope: scopes.join(" ")
    });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const expiresIn = Number(params.get("expires_in") ?? "0");

    if (accessToken && refreshToken && expiresIn > 0) {
      const newState = {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + expiresIn * 1000
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      setTokenState(newState);
      params.delete("access_token");
      params.delete("refresh_token");
      params.delete("expires_in");
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState({}, "", newUrl);
      return;
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as TokenState;
      setTokenState(parsed);
    }
  }, []);

  useEffect(() => {
    if (!tokenState?.refreshToken) {
      return;
    }

    const refreshIfNeeded = async () => {
      if (Date.now() < tokenState.expiresAt - 60_000) {
        return;
      }

      const response = await fetch("/api/spotify/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: tokenState.refreshToken })
      });

      if (!response.ok) {
        setStatus("Failed to refresh Spotify token");
        return;
      }

      const data = (await response.json()) as { access_token: string; expires_in: number };
      const updated = {
        ...tokenState,
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000
      };
      setTokenState(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    };

    refreshIfNeeded();
    const timer = window.setInterval(refreshIfNeeded, 30_000);
    return () => window.clearInterval(timer);
  }, [tokenState]);

  useEffect(() => {
    if (!tokenState?.accessToken) {
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: "Digital Ops WhatsApp Jukebox",
        getOAuthToken: (callback) => callback(tokenState.accessToken),
        volume: 0.8
      });

      player.addListener("ready", (event) => {
        const payload = event as { device_id: string };
        setDeviceId(payload.device_id);
        setStatus("Spotify player connected");
      });

      player.addListener("not_ready", () => setStatus("Spotify player disconnected"));
      player.addListener("initialization_error", () => setStatus("Spotify player init error"));
      player.addListener("authentication_error", () => setStatus("Spotify auth error"));
      player.addListener("account_error", () => setStatus("Spotify Premium required"));

      player.connect();
      playerRef.current = player;
      setSdkReady(true);
    };

    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
      setSdkReady(false);
    };
  }, [tokenState?.accessToken]);

  useEffect(() => {
    if (!tokenState?.accessToken || !deviceId) {
      return;
    }

    const pollLatestRequest = async () => {
      const response = await fetch("/api/requests/latest", { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as { request: SongRequest | null };
      setLatestRequest(data.request);

      if (!data.request || data.request.id === lastPlayedRequestIdRef.current || isPlayingRequest) {
        return;
      }

      setIsPlayingRequest(true);
      try {
        const playResponse = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${tokenState.accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ uris: [data.request.uri] })
        });

        if (playResponse.ok || playResponse.status === 204) {
          lastPlayedRequestIdRef.current = data.request.id;
          setStatus(`Now playing: ${data.request.title} — ${data.request.artist}`);
        } else {
          setStatus("Failed to play request. Open Spotify once and keep this page active.");
        }
      } finally {
        setIsPlayingRequest(false);
      }
    };

    pollLatestRequest();
    const interval = window.setInterval(pollLatestRequest, 4000);
    return () => window.clearInterval(interval);
  }, [tokenState?.accessToken, deviceId, isPlayingRequest]);

  return (
    <main>
      <h1>Spotify + Twilio WhatsApp Jukebox</h1>
      <p className="muted">
        Send a WhatsApp message with a song title to Twilio. This page polls the latest request and plays it in Spotify.
      </p>

      <section className="card">
        <h2>1) Connect Spotify</h2>
        <p className="muted">A Spotify Premium account is required for Web Playback SDK streaming.</p>
        {!tokenState ? (
          <a href={spotifyAuthUrl}>
            <button>Authorize Spotify</button>
          </a>
        ) : (
          <div>
            <p>Spotify authorized.</p>
            <button
              className="secondary"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                window.location.reload();
              }}
            >
              Disconnect
            </button>
          </div>
        )}
        <p>
          <strong>Status:</strong> {status}
        </p>
        <p>
          <strong>Device ID:</strong> {deviceId || "Not ready"}
        </p>
        <p>
          <strong>SDK:</strong> {sdkReady ? "Loaded" : "Not loaded"}
        </p>
      </section>

      <section className="card">
        <h2>2) WhatsApp Song Requests</h2>
        <p>
          Configure Twilio webhook URL to <code>/api/twilio/whatsapp</code>.
        </p>
        <p className="muted">Example message: Shape of You by Ed Sheeran</p>
        {latestRequest ? (
          <div>
            <p>
              <strong>Latest:</strong> {latestRequest.title} — {latestRequest.artist}
            </p>
            <p className="muted">
              Query: {latestRequest.query} | From: {latestRequest.from} | At: {new Date(latestRequest.createdAt).toLocaleString()}
            </p>
          </div>
        ) : (
          <p className="muted">No WhatsApp requests received yet.</p>
        )}
      </section>
    </main>
  );
}
