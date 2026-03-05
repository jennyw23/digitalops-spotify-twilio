declare global {
  type SpotifyPlayer = {
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(event: string, callback: (...args: unknown[]) => void): boolean;
    removeListener(event: string, callback?: (...args: unknown[]) => void): boolean;
  };

  interface Window {
    onSpotifyWebPlaybackSDKReady: (() => void) | undefined;
    Spotify: {
      Player: new (options: {
        name: string;
        getOAuthToken: (callback: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayer;
    };
  }
}

export {};
