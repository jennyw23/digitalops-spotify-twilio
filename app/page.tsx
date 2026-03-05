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
  const [searchedArtistName, setSearchedArtistName] = useState("");
  
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

  // Load artist data for demo tab
  const searchArtist = async () => {
    if (!tokenState?.accessToken) {
      alert("Please log in with Spotify first!");
      return;
    }
    
    if (!artistQuery.trim()) return;
    
    setLoadingArtist(true);
    setArtistData(null);
    try {
      // First, search for artist by name
      const searchRes = await fetch(`/api/spotify/search-artist?q=${encodeURIComponent(artistQuery)}`);
      const searchData = await searchRes.json();
      
      if (searchData.error) {
        console.error("Search error:", searchData.error);
        alert("Artist search error: " + searchData.error);
        setLoadingArtist(false);
        return;
      }
      
      setSearchedArtistName(searchData.artistName);
      
      // Then get full artist data with user token (required for these endpoints)
      const artistRes = await fetch(`/api/spotify/artist?id=${searchData.artistId}&userToken=${encodeURIComponent(tokenState.accessToken)}`);
      const artistData = await artistRes.json();
      
      console.log("Artist response:", artistData);
      
      if (artistData.error) {
        console.error("Artist data error:", artistData.error);
        alert("Artist data error: " + artistData.error);
      } else if (artistData.artist && artistData.latestAlbum) {
        setArtistData(artistData);
      } else {
        console.error("Invalid artist response:", artistData);
        alert("Invalid artist response structure");
      }
    } catch (err) {
      console.error("Search exception:", err);
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
        
        // Set as active playlist
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

    // Create CSV header
    const headers = ["Timestamp", "Song Title", "Artist", "Requester", "Query"];
    const rows = songRequests.map(req => [
      new Date(req.createdAt).toLocaleString(),
      req.title || "",
      req.artist || "",
      req.from || "",
      req.query || ""
    ]);

    // Build CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    // Download
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
    // Load active playlist on mount
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
    if (!tokenState?.accessToken || activeTab === "demo") {
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

      // Track all requests
      setSongRequests(prevRequests => {
        const exists = prevRequests.some(r => r.id === data.request!.id);
        if (!exists) {
          return [data.request!, ...prevRequests];
        }
        return prevRequests;
      });

      setIsPlayingRequest(true);
      try {
        if (activePlaylistMode && playlistId) {
          // Add to playlist
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
          // Play on device
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
            <h2>Spotify API Exploration</h2>
            <p className="muted">
              This demonstrates how we call the Spotify API to retrieve artist information, top tracks, and album data.
            </p>
            
            {!tokenState ? (
              <div style={{ 
                padding: "16px", 
                marginTop: "16px", 
                backgroundColor: "rgba(30, 215, 96, 0.1)", 
                borderRadius: "8px",
                border: "1px solid rgb(30, 215, 96)"
              }}>
                <p style={{ margin: "0 0 12px 0", fontWeight: 600 }}>
                  🔑 Spotify Login Required
                </p>
                <p style={{ margin: "0 0 12px 0", fontSize: "14px" }}>
                  To search for artists and view their data, you need to authorize with Spotify first.
                </p>
                <a href={spotifyAuthUrl}>
                  <button style={{ marginTop: "8px" }}>Log In with Spotify</button>
                </a>
              </div>
            ) : (
              <div style={{ marginTop: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
                  Search for an artist:
                </label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="text"
                    value={artistQuery}
                    onChange={(e) => setArtistQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchArtist()}
                    placeholder="e.g., Taylor Swift, The Weeknd, Ed Sheeran..."
                    style={{ flex: 1 }}
                  />
                  <button onClick={searchArtist} disabled={loadingArtist || !artistQuery.trim()}>
                    {loadingArtist ? "Searching..." : "Search"}
                  </button>
                </div>
              </div>
            )}

            {loadingArtist && <p style={{ marginTop: "16px" }}>Loading artist data from Spotify API...</p>}

            {artistData && !loadingArtist && (
              <div style={{ marginTop: "24px" }}>
                <div className="artist-info">
                  {artistData.artist.images[0] && (
                    <Image
                      src={artistData.artist.images[0].url}
                      alt={artistData.artist.name}
                      className="artist-image"
                      width={180}
                      height={180}
                    />
                  )}
                  <div>
                    <h3 style={{ margin: "0 0 8px 0" }}>{artistData.artist.name}</h3>
                    {artistData.artist.followers && (
                      <p className="muted" style={{ margin: "4px 0" }}>
                        {artistData.artist.followers.total.toLocaleString()} followers
                      </p>
                    )}
                    {artistData.artist.genres && artistData.artist.genres.length > 0 && (
                      <p className="muted" style={{ margin: "4px 0" }}>
                        Genres: {artistData.artist.genres.slice(0, 3).join(", ")}
                      </p>
                    )}
                  </div>
                </div>

                {artistData.latestAlbum && (
                  <div style={{ marginTop: "24px" }}>
                    <h3>Latest Album</h3>
                    <div style={{ display: "flex", gap: "16px", marginTop: "16px" }}>
                      {artistData.latestAlbum.images[0] && (
                        <Image
                          src={artistData.latestAlbum.images[0].url}
                          alt={artistData.latestAlbum.name}
                          width={160}
                          height={160}
                          style={{ borderRadius: "8px" }}
                        />
                      )}
                      <div>
                        <p style={{ margin: "0 0 8px 0", fontWeight: 600, fontSize: "16px" }}>
                          {artistData.latestAlbum.name}
                        </p>
                        <p className="muted" style={{ margin: "0 0 16px 0" }}>
                          Released {artistData.latestAlbum.release_date}
                        </p>
                        <h4 style={{ margin: "0 0 12px 0" }}>Tracks</h4>
                        <ul className="track-list">
                          {artistData.tracks.map((track, i) => (
                            <li key={i} className="track-item">
                              <strong>{track.track_number}. {track.name}</strong>
                              <br />
                              <span className="muted">
                                {Math.floor(track.duration_ms / 60000)}:{String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {!artistData && !loadingArtist && artistQuery && (
              <p className="muted" style={{ marginTop: "16px" }}>Enter an artist name and click Search to see data from the Spotify API.</p>
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
              You&apos;ll receive a confirmation once joined.
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

      {activeTab === "playlist" && (
        <>
          <section className="card">
            <h2>Song Requests Log</h2>
            <p className="muted">
              All song requests received via WhatsApp. Download as CSV for analysis or record-keeping.
            </p>
            
            <button 
              onClick={downloadCSV}
              disabled={songRequests.length === 0}
              style={{ marginTop: "12px", backgroundColor: "#238636" }}
            >
              📥 Download as CSV
            </button>

            {songRequests.length > 0 ? (
              <div style={{ marginTop: "24px" }}>
                <p style={{ fontWeight: 600, marginBottom: "12px" }}>
                  Total Requests: {songRequests.length}
                </p>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ 
                    width: "100%", 
                    borderCollapse: "collapse",
                    fontSize: "14px"
                  }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #30363d" }}>
                        <th style={{ padding: "8px", textAlign: "left" }}>Time</th>
                        <th style={{ padding: "8px", textAlign: "left" }}>Song</th>
                        <th style={{ padding: "8px", textAlign: "left" }}>Artist</th>
                        <th style={{ padding: "8px", textAlign: "left" }}>From</th>
                        <th style={{ padding: "8px", textAlign: "left" }}>Query</th>
                      </tr>
                    </thead>
                    <tbody>
                      {songRequests.map((req) => (
                        <tr key={req.id} style={{ borderBottom: "1px solid #21262d" }}>
                          <td style={{ padding: "8px" }}>
                            {new Date(req.createdAt).toLocaleString()}
                          </td>
                          <td style={{ padding: "8px", fontWeight: 500 }}>
                            {req.title || "-"}
                          </td>
                          <td style={{ padding: "8px" }}>
                            {req.artist || "-"}
                          </td>
                          <td style={{ padding: "8px" }}>
                            {req.from || "-"}
                          </td>
                          <td style={{ padding: "8px", fontSize: "12px", color: "#8b949e" }}>
                            {req.query || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{
                marginTop: "24px",
                padding: "24px",
                textAlign: "center",
                backgroundColor: "rgba(30, 215, 96, 0.05)",
                borderRadius: "8px",
                border: "1px dashed rgba(30, 215, 96, 0.3)"
              }}>
                <p className="muted">
                  📭 No song requests yet.
                </p>
                <p className="muted" style={{ fontSize: "12px", marginTop: "8px" }}>
                  Send a WhatsApp message to <strong>+1 415 523 8886</strong> with a song title to get started.
                </p>
              </div>
            )}
          </section>

          {latestRequest && (
            <section className="card">
              <h2>Latest Request</h2>
              <div style={{ background: "#0d1117", padding: "16px", borderRadius: "8px" }}>
                <p style={{ margin: "4px 0" }}>
                  <strong>🎵 Track:</strong> {latestRequest.title}
                </p>
                <p style={{ margin: "4px 0" }}>
                  <strong>👤 Artist:</strong> {latestRequest.artist}
                </p>
                <p style={{ margin: "4px 0" }}>
                  <strong>💬 From:</strong> {latestRequest.from}
                </p>
                <p style={{ margin: "4px 0" }}>
                  <strong>🔍 Query:</strong> <code>{latestRequest.query}</code>
                </p>
                <p style={{ margin: "4px 0" }}>
                  <strong>🕐 Time:</strong> {new Date(latestRequest.createdAt).toLocaleString()}
                </p>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
