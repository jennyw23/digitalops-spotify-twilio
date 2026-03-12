"use client";

import Image from "next/image";
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
  latestAlbum: {
    name: string;
    release_date: string;
    images: Array<{ url: string }>;
  };
  tracks: Array<{
    name: string;
    duration_ms: number;
    track_number: number;
  }>;
};

const STORAGE_KEY = "spotify_token_state";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"demo" | "jukebox" | "playlist">("demo");
  const [tokenState, setTokenState] = useState<TokenState | null>(null);
  const [deviceId, setDeviceId] = useState<string>("");
  const [latestRequest, setLatestRequest] = useState<SongRequest | null>(null);
  const [status, setStatus] = useState<string>("Not connected");
  const [sdkReady, setSdkReady] = useState(false);
  const [isPlayingRequest, setIsPlayingRequest] = useState(false);

  // Demo tab state
  const [artistData, setArtistData] = useState<ArtistData | null>(null);
  const [loadingArtist, setLoadingArtist] = useState(false);
  const [artistQuery, setArtistQuery] = useState("");

  // Playlist tab state
  const [playlistId, setPlaylistId] = useState<string>("");
  const [playlistUrl, setPlaylistUrl] = useState<string>("");
  const [playlistName, setPlaylistName] = useState<string>("");
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [activePlaylistMode, setActivePlaylistMode] = useState(false);

  // Song requests log state
  const [songRequests, setSongRequests] = useState<SongRequest[]>([]);

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
      "user-modify-playback-state",
      "playlist-modify-public",
      "playlist-modify-private"
    ];
    const params = new URLSearchParams({
      client_id: clientId ?? "",
      response_type: "code",
      redirect_uri: redirectUri,
      scope: scopes.join(" ")
    });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }, []);

  const searchArtist = async () => {
    if (!tokenState?.accessToken) {
      alert("Please log in with Spotify first!");
      return;
    }

    if (!artistQuery.trim()) return;

    setLoadingArtist(true);
    setArtistData(null);
    try {
      const searchRes = await fetch(`/api/spotify/search-artist?q=${encodeURIComponent(artistQuery)}`);
      const searchData = await searchRes.json();

      if (searchData.error) {
        alert("Artist search error: " + searchData.error);
        return;
      }

      const artistRes = await fetch(
        `/api/spotify/artist?id=${searchData.artistId}&userToken=${encodeURIComponent(tokenState.accessToken)}`
      );
      const artistResult = await artistRes.json();

      if (artistResult.error) {
        alert("Artist data error: " + artistResult.error);
      } else if (artistResult.artist && artistResult.latestAlbum) {
        setArtistData(artistResult);
      } else {
        alert("Invalid artist response structure");
      }
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setLoadingArtist(false);
    }
  };

  const createPlaylist = async () => {
    if (!tokenState?.accessToken) return;

    setCreatingPlaylist(true);
    try {
      const res = await fetch("/api/spotify/playlist/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: tokenState.accessToken,
          name: "WhatsApp Song Requests",
          description: "Songs requested via WhatsApp - Digital Ops Demo"
        })
      });

      const data = await res.json();
      if (data.error) {
        alert("Failed to create playlist: " + data.error);
      } else {
        setPlaylistId(data.playlistId);
        setPlaylistUrl(data.url);
        setPlaylistName(data.name);

        await fetch("/api/playlist/set-active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playlistId: data.playlistId })
        });
        setActivePlaylistMode(true);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to create playlist");
    } finally {
      setCreatingPlaylist(false);
    }
  };

  const togglePlaylistMode = async (enabled: boolean) => {
    await fetch("/api/playlist/set-active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playlistId: enabled ? playlistId : null })
    });
    setActivePlaylistMode(enabled);
  };

  const downloadCSV = () => {
    if (songRequests.length === 0) {
      alert("No song requests to download yet");
      return;
    }

    const headers = ["Timestamp", "Song Title", "Artist", "Requester", "Query"];
    const rows = songRequests.map(req => [
      new Date(req.createdAt).toLocaleString(),
      req.title || "",
      req.artist || "",
      req.from || "",
      req.query || ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `song-requests-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    fetch("/api/playlist/get-active")
      .then(res => res.json())
      .then(data => {
        if (data.playlistId) {
          setPlaylistId(data.playlistId);
          setActivePlaylistMode(true);
        }
      })
      .catch(console.error);
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
    if (!tokenState?.refreshToken) return;

    const refreshIfNeeded = async () => {
      if (Date.now() < tokenState.expiresAt - 60_000) return;

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
    if (!tokenState?.accessToken || activeTab !== "jukebox") return;

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: "Digital Ops WhatsApp Jukebox",
        getOAuthToken: callback => callback(tokenState.accessToken),
        volume: 0.8
      });

      player.addListener("ready", event => {
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
    if (!tokenState?.accessToken || activeTab === "demo") return;

    const pollLatestRequest = async () => {
      const response = await fetch("/api/requests/latest", { cache: "no-store" });
      if (!response.ok) return;

      const data = (await response.json()) as { request: SongRequest | null };
      setLatestRequest(data.request);

      if (!data.request || data.request.id === lastPlayedRequestIdRef.current || isPlayingRequest) return;

      setSongRequests(prevRequests => {
        const exists = prevRequests.some(r => r.id === data.request!.id);
        if (!exists) return [data.request!, ...prevRequests];
        return prevRequests;
      });

      setIsPlayingRequest(true);
      try {
        if (activePlaylistMode && playlistId) {
          const addRes = await fetch("/api/spotify/playlist/add-track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accessToken: tokenState.accessToken,
              playlistId,
              trackUri: data.request.uri
            })
          });

          if (addRes.ok) {
            lastPlayedRequestIdRef.current = data.request.id;
            setStatus(`Added to playlist: ${data.request.title} — ${data.request.artist}`);
          } else {
            setStatus("Failed to add to playlist");
          }
        } else if (deviceId && activeTab === "jukebox") {
          const playResponse = await fetch(
            `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${tokenState.accessToken}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ uris: [data.request.uri] })
            }
          );

          if (playResponse.ok || playResponse.status === 204) {
            lastPlayedRequestIdRef.current = data.request.id;
            setStatus(`Now playing: ${data.request.title} — ${data.request.artist}`);
          } else {
            setStatus("Failed to play request. Open Spotify once and keep this page active.");
          }
        }
      } finally {
        setIsPlayingRequest(false);
      }
    };

    pollLatestRequest();
    const interval = window.setInterval(pollLatestRequest, 4000);
    return () => window.clearInterval(interval);
  }, [tokenState?.accessToken, deviceId, isPlayingRequest, activeTab, activePlaylistMode, playlistId]);

  return (
    <main>
      <div className="app-header">
        <h1>Spotify + Twilio Integration</h1>
        <p>Two-layer API demo: Spotify Web API for music data &amp; Twilio WhatsApp for remote control.</p>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === "demo" ? "active" : ""}`} onClick={() => setActiveTab("demo")}>
          📊 Spotify API Demo
        </button>
        <button className={`tab ${activeTab === "jukebox" ? "active" : ""}`} onClick={() => setActiveTab("jukebox")}>
          📱 WhatsApp Jukebox
        </button>
        <button
          className={`tab ${activeTab === "playlist" ? "active" : ""}`}
          onClick={() => setActiveTab("playlist")}
        >
          📋 Song Requests
        </button>
      </div>

      {activeTab === "demo" && (
        <>
          <section className="card">
            <h2>Spotify API Explorer</h2>
            <p className="muted" style={{ margin: "4px 0 20px" }}>
              Search for any artist to see their profile, latest album, and tracklist pulled live from the Spotify API.
            </p>

            {!tokenState ? (
              <div className="auth-box">
                <p style={{ margin: "0 0 6px 0", fontWeight: 700, fontSize: "15px" }}>🔑 Spotify Login Required</p>
                <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "var(--muted-light)" }}>
                  Authorize with Spotify to search for artists and view their data.
                </p>
                <a href={spotifyAuthUrl}>
                  <button>Log In with Spotify</button>
                </a>
              </div>
            ) : (
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 600, fontSize: "14px" }}>
                  Search for an artist
                </label>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <input
                    type="text"
                    value={artistQuery}
                    onChange={e => setArtistQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && searchArtist()}
                    placeholder="e.g., Taylor Swift, The Weeknd, Ed Sheeran…"
                    style={{ maxWidth: "none" }}
                  />
                  <button
                    onClick={searchArtist}
                    disabled={loadingArtist || !artistQuery.trim()}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {loadingArtist ? "Searching…" : "Search"}
                  </button>
                </div>
              </div>
            )}

            {loadingArtist && (
              <p className="muted" style={{ marginTop: "20px" }}>
                Loading artist data from Spotify API…
              </p>
            )}
          </section>

          {artistData && !loadingArtist && (
            <>
              <section className="card">
                <div className="artist-header">
                  {artistData.artist.images[0] && (
                    <Image
                      src={artistData.artist.images[0].url}
                      alt={artistData.artist.name}
                      className="artist-image"
                      width={100}
                      height={100}
                    />
                  )}
                  <div className="artist-meta">
                    <h3>{artistData.artist.name}</h3>
                    {artistData.artist.followers && (
                      <p className="muted">
                        {artistData.artist.followers.total.toLocaleString()} followers
                      </p>
                    )}
                    {artistData.artist.genres && artistData.artist.genres.length > 0 && (
                      <div style={{ marginTop: "8px" }}>
                        {artistData.artist.genres.slice(0, 4).map(g => (
                          <span key={g} className="genre-pill">{g}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {artistData.latestAlbum && (
                <section className="card">
                  <h2>Latest Album</h2>
                  <div className="album-card">
                    {artistData.latestAlbum.images[0] && (
                      <Image
                        src={artistData.latestAlbum.images[0].url}
                        alt={artistData.latestAlbum.name}
                        className="album-image"
                        width={140}
                        height={140}
                      />
                    )}
                    <div className="album-meta" style={{ flex: 1 }}>
                      <h4>{artistData.latestAlbum.name}</h4>
                      <p>Released {artistData.latestAlbum.release_date}</p>
                    </div>
                  </div>

                  <h3>Tracklist</h3>
                  <ul className="track-list">
                    {artistData.tracks.map((track, i) => (
                      <li key={i} className="track-item">
                        <span className="track-number">{track.track_number}</span>
                        <span className="track-name">{track.name}</span>
                        <span className="track-duration">
                          {Math.floor(track.duration_ms / 60000)}:
                          {String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, "0")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </>
      )}

      {activeTab === "jukebox" && (
        <>
          <section className="card">
            <h2>
              <span className="step-label">1</span>Connect Spotify
            </h2>
            <p className="muted" style={{ marginTop: 4, marginBottom: 16 }}>
              A Spotify Premium account is required for Web Playback SDK streaming.
            </p>
            {!tokenState ? (
              <a href={spotifyAuthUrl}>
                <button>Authorize Spotify</button>
              </a>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span className="status-badge connected">✓ Spotify authorized</span>
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
            <div className="data-box" style={{ marginTop: 16 }}>
              <div className="info-row">
                <strong>Status</strong>
                <span>{status}</span>
              </div>
              <div className="info-row">
                <strong>Device ID</strong>
                <span className="muted">{deviceId || "Not ready"}</span>
              </div>
              <div className="info-row">
                <strong>SDK</strong>
                <span className="muted">{sdkReady ? "Loaded" : "Not loaded"}</span>
              </div>
            </div>
          </section>

          <section className="card">
            <h2>
              <span className="step-label">2</span>Join WhatsApp Sandbox
            </h2>
            <p className="muted" style={{ marginTop: 4 }}>Send this message on WhatsApp to join the sandbox:</p>
            <div className="sandbox-box">
              <p>
                <strong>Phone:</strong> <code>+1 415 523 8886</code>
              </p>
              <p>
                <strong>Message:</strong> <code>join ill-state</code>
              </p>
            </div>
            <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
              You&apos;ll receive a confirmation once joined.
            </p>
          </section>

          <section className="card">
            <h2>
              <span className="step-label">3</span>Request a Song
            </h2>
            <p style={{ marginTop: 4 }}>
              Send a song title to the same number, e.g.:{" "}
              <code>Blinding Lights by The Weeknd</code>
            </p>
            <p className="muted" style={{ fontSize: 13 }}>
              The app will search Spotify and play it automatically on this page.
            </p>

            {latestRequest ? (
              <div className="data-box">
                <div className="info-row">
                  <strong>Track</strong>
                  <span>{latestRequest.title} — {latestRequest.artist}</span>
                </div>
                <div className="info-row">
                  <strong>From</strong>
                  <span className="muted">{latestRequest.from}</span>
                </div>
                <div className="info-row">
                  <strong>Query</strong>
                  <code>{latestRequest.query}</code>
                </div>
                <div className="info-row">
                  <strong>Time</strong>
                  <span className="muted">{new Date(latestRequest.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <p className="muted" style={{ marginTop: 16, fontSize: 14 }}>
                No WhatsApp requests received yet.
              </p>
            )}
          </section>
        </>
      )}

      {activeTab === "playlist" && (
        <>
          <section className="card">
            <h2>Song Requests Log</h2>
            <p className="muted" style={{ marginTop: 4, marginBottom: 16 }}>
              All song requests received via WhatsApp. Download as CSV for analysis or record-keeping.
            </p>

            <button onClick={downloadCSV} disabled={songRequests.length === 0}>
              📥 Download as CSV
            </button>

            {songRequests.length > 0 ? (
              <div style={{ marginTop: 24 }}>
                <p style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>
                  Total Requests: {songRequests.length}
                </p>
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Song</th>
                        <th>Artist</th>
                        <th>From</th>
                        <th>Query</th>
                      </tr>
                    </thead>
                    <tbody>
                      {songRequests.map(req => (
                        <tr key={req.id}>
                          <td className="muted" style={{ whiteSpace: "nowrap", fontSize: 13 }}>
                            {new Date(req.createdAt).toLocaleString()}
                          </td>
                          <td style={{ fontWeight: 500 }}>{req.title || "—"}</td>
                          <td className="muted">{req.artist || "—"}</td>
                          <td className="muted">{req.from || "—"}</td>
                          <td style={{ fontSize: 12 }}>
                            <code>{req.query || "—"}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p className="muted" style={{ margin: 0 }}>📭 No song requests yet.</p>
                <p className="muted" style={{ fontSize: 13, marginTop: 8, marginBottom: 0 }}>
                  Send a WhatsApp message to <strong>+1 415 523 8886</strong> with a song title to get started.
                </p>
              </div>
            )}
          </section>

          {latestRequest && (
            <section className="card">
              <h2>Latest Request</h2>
              <div className="data-box">
                <div className="info-row">
                  <strong>🎵 Track</strong>
                  <span>{latestRequest.title}</span>
                </div>
                <div className="info-row">
                  <strong>👤 Artist</strong>
                  <span>{latestRequest.artist}</span>
                </div>
                <div className="info-row">
                  <strong>💬 From</strong>
                  <span className="muted">{latestRequest.from}</span>
                </div>
                <div className="info-row">
                  <strong>🔍 Query</strong>
                  <code>{latestRequest.query}</code>
                </div>
                <div className="info-row">
                  <strong>🕐 Time</strong>
                  <span className="muted">{new Date(latestRequest.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
