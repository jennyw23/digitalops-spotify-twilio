# Spotify + Twilio WhatsApp Jukebox (Vercel-ready)

This project is a Next.js app with two layers of API communication:

1. **Spotify API:** Browse artist data, play music in the browser, and create/manage playlists
2. **Twilio WhatsApp:** Remote control via WhatsApp messages to queue songs or add them to playlists

## Features

### Tab 1: Spotify API Demo
- Search for any artist by name
- View artist information, top tracks, and recent albums
- Demonstrates real-time API requests and responses

### Tab 2: WhatsApp Jukebox
- Send WhatsApp messages with song titles
- Songs automatically play in your browser via Spotify Web Playback SDK
- Real-time polling and playback control

### Tab 3: Playlist Builder  
- Create a Spotify playlist via the API
- WhatsApp song requests automatically add tracks to your playlist
- Toggle between play mode and playlist mode

## Requirements

- Node.js 18+
- Spotify Premium account (required by Web Playback SDK)
- Spotify Developer app
- Twilio account + WhatsApp Sandbox (or approved WhatsApp sender)
- (Recommended for deployment) Vercel KV for persistent request state

## Local setup

1. Install dependencies:

	```bash
	npm install
	```

2. Copy env template:

	```bash
	cp .env.example .env.local
	```

3. Fill `.env.local` values:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI=http://localhost:3000/api/spotify/callback`
- `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` (same as `SPOTIFY_CLIENT_ID`)
- `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886` (sandbox default)
- Optional local-only fallback: do not set KV vars.
- For production persistence, set:
  - `KV_REST_API_URL`
  - `KV_REST_API_TOKEN`

4. In Spotify Developer Dashboard:

- Add Redirect URI: `http://localhost:3000/api/spotify/callback`
- Scopes used: `streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state`

5. Run dev server:

	```bash
	npm run dev
	```

## Twilio WhatsApp setup

In Twilio WhatsApp Sandbox settings, set **When a message comes in** webhook to:

`https://<your-domain>/api/twilio/whatsapp`

For local testing, use ngrok:

```bash
ngrok http 3000
```

Then use the generated HTTPS URL in Twilio.

## Deploy on Vercel

1. Push this folder to GitHub.
2. Import project in Vercel.
3. Add all environment variables from `.env.example` in Vercel Project Settings.
4. Add Vercel KV integration (recommended) and ensure `KV_REST_API_URL` + `KV_REST_API_TOKEN` are set.
5. Update Spotify Redirect URI to:

`https://<your-vercel-domain>/api/spotify/callback`

6. Update Twilio incoming webhook to:

`https://<your-vercel-domain>/api/twilio/whatsapp`

## API routes

- `GET /api/spotify/callback` - Spotify OAuth callback and token exchange.
- `POST /api/spotify/refresh` - Refresh user Spotify access token.
- `GET /api/spotify/search?q=...` - Search track by query.
- `POST /api/twilio/whatsapp` - Twilio inbound WhatsApp webhook.
- `GET /api/requests/latest` - Latest song request for the player.

## Notes

- Spotify playback from a website requires Premium and an active browser session on the app page.
- If playback fails, open Spotify once and keep the app tab active.
- Twilio webhook signature validation is enabled when `TWILIO_AUTH_TOKEN` is set, preventing unauthorized requests.