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

type ArtistData = {
  artist: {
    name: string;
    images: Array<{ url: string }>;
    genres: string[];
    followers: { total: number };
  };
  topTracks: {
    tracks: Array<{
      name: string;
      album: { name: string };
      duration_ms: number;
    }>;
  };
  albums: {
    items: Array<{
      name: string;
      release_date: string;
      total_tracks: number;
    }>;
  };
};

const STORAGE_KEY = "spotify_token_state";

// Sample artist IDs for demo
const SAMPLE_ARTISTS = [
  { name: "Taylor Swift", id: "06HL4z0CvFAxyc27GXpf02" },
  { name: "The Weeknd", id: "1Xyo4u8uXC1ZmMpatF05PJ" },
  { name: "Ed Sheeran", id: "6eUKZXaKkcviH0Ku9w2n3V" }
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"demo" | "jukebox">("demo");
  const [tokenState, setTokenState] = useState<TokenState | null>(null);
  const [deviceId, setDeviceId] = useState<string>("");
  const [latestRequest, setLatestRequest] = useState<SongRequest | null>(null);
  const [status, setStatus] = useState<string>("Not connected");
  const [sdkReady, setSdkReady] = useState(false);
  const [isPlayingRequest, setIsPlayingRequest] = useState(false);
  
  // Demo tab state
  const [artistData, setArtistData] = useState<ArtistData | null>(null);
  const [loadingArtist, setLoadingArtist] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState(SAMPLE_ARTISTS[0].id);

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

  // Load artist data for demo tab
  useEffect(() => {
    if (activeTab !== "demo" || !selectedArtist) return;
    
    setLoadingArtist(true);
    fetch(`/api/spotify/artist?id=${selectedArtist}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          console.error(data.error);
        } else {
          setArtistData(data);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoadingArtist(false));
  }, [selectedArtist, activeTab]);

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
    if (!tokenState?.accessToken || activeTab !== "jukebox") {
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
  }, [tokenState?.accessToken, activeTab]);

  useEffect(() => {
    if (!tokenState?.accessToken || !deviceId || activeTab !== "jukebox") {
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
  }, [tokenState?.accessToken, deviceId, isPlayingRequest, activeTab]);

  return (
    <main>
      <h1>Spotify + Twilio API Communication Demo</h1>
      <p className="muted">
        Showcasing two-layer API integration: Spotify Web API for music data and Twilio WhatsApp for remote control.
      </p>

      <div className="tabs">
        <button
          className={`tab ${activeTab === "demo" ? "active" : ""}`}
          onClick={() => setActiveTab("demo")}
        >
          📊 Spotify API Demo
        </button>
        <button
          className={`tab ${activeTab === "jukebox" ? "active" : ""}`}
          onClick={() => setActiveTab("jukebox")}
        >
          📱 WhatsApp Jukebox
        </button>
      </div>

      {activeTab === "demo" && (
        <>
          <section className="card">
            <h2>Spotify API Exploration</h2>
            <p className="muted">
              This demonstrates how we call the Spotify API to retrieve artist information, top tracks, and album data.
            </p>
            
            <div style={{ marginTop: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
                Select an artist:
              </label>
              <select
                value={selectedArtist}
                onChange={(e) => setSelectedArtist(e.target.value)}
                style={{
                  background: "#0d1117",
                  border: "1px solid #30363d",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  color: "#e6edf3",
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                {SAMPLE_ARTISTS.map(artist => (
                  <option key={artist.id} value={artist.id}>{artist.name}</option>
                ))}
              </select>
            </div>

            {loadingArtist && <p style={{ marginTop: "16px" }}>Loading artist data...</p>}

            {artistData && !loadingArtist && (
              <div style={{ marginTop: "24px" }}>
                <div className="artist-info">
                  {artistData.artist.images[0] && (
                    <img
                      src={artistData.artist.images[0].url}
                      alt={artistData.artist.name}
                      className="artist-image"
                    />
                  )}
                  <div>
                    <h3 style={{ margin: "0 0 8px 0" }}>{artistData.artist.name}</h3>
                    <p className="muted" style={{ margin: "4px 0" }}>
                      {artistData.artist.followers.total.toLocaleString()} followers
                    </p>
                    <p className="muted" style={{ margin: "4px 0" }}>
                      Genres: {artistData.artist.genres.slice(0, 3).join(", ")}
                    </p>
                  </div>
                </div>

                <h3 style={{ marginTop: "24px" }}>Top Tracks</h3>
                <ul className="track-list">
                  {artistData.topTracks.tracks.slice(0, 5).map((track, i) => (
                    <li key={i} className="track-item">
                      <strong>{track.name}</strong>
                      <br />
                      <span className="muted">
                        {track.album.name} • {Math.floor(track.duration_ms / 60000)}:{String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}
                      </span>
                    </li>
                  ))}
                </ul>

                <h3 style={{ marginTop: "24px" }}>Recent Albums</h3>
                <ul className="track-list">
                  {artistData.albums.items.slice(0, 5).map((album, i) => (
                    <li key={i} className="track-item">
                      <strong>{album.name}</strong>
                      <br />
                      <span className="muted">
                        {album.release_date} • {album.total_tracks} tracks
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === "jukebox" && (
        <>
          <section className="card">
            <h2>Step 1: Connect Spotify</h2>
            <p className="muted">A Spotify Premium account is required for Web Playback SDK streaming.</p>
            {!tokenState ? (
              <a href={spotifyAuthUrl}>
                <button>Authorize Spotify</button>
              </a>
            ) : (
              <div>
                <p>✓ Spotify authorized.</p>
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
            <p style={{ marginTop: "12px" }}>
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
            <h2>Step 2: Join WhatsApp Sandbox</h2>
            <p>Send this message on WhatsApp to join the sandbox:</p>
            <div style={{ background: "#0d1117", padding: "12px", borderRadius: "8px", marginTop: "12px" }}>
              <p style={{ margin: "4px 0" }}>
                <strong>Phone number:</strong> <code>+1 415 523 8886</code>
              </p>
              <p style={{ margin: "4px 0" }}>
                <strong>Message:</strong> <code>join ill-state</code>
              </p>
            </div>
            <p className="muted" style={{ marginTop: "12px" }}>
              You'll receive a confirmation once joined.
            </p>
          </section>

          <section className="card">
            <h2>Step 3: Request a Song</h2>
            <p>
              After joining, send a song title to the same number. Example: <code>Blinding Lights by The Weeknd</code>
            </p>
            <p className="muted">
              The app will search Spotify and play it automatically on this page!
            </p>
            
            {latestRequest ? (
              <div style={{ marginTop: "16px", background: "#0d1117", padding: "12px", borderRadius: "8px" }}>
                <p style={{ margin: "4px 0" }}>
                  <strong>Latest Request:</strong> {latestRequest.title} — {latestRequest.artist}
                </p>
                <p className="muted" style={{ margin: "4px 0" }}>
                  Query: {latestRequest.query}
                </p>
                <p className="muted" style={{ margin: "4px 0" }}>
                  From: {latestRequest.from}
                </p>
                <p className="muted" style={{ margin: "4px 0" }}>
                  At: {new Date(latestRequest.createdAt).toLocaleString()}
                </p>
              </div>
            ) : (
              <p className="muted" style={{ marginTop: "16px" }}>No WhatsApp requests received yet.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
