import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Spotify + Twilio WhatsApp Demo",
  description: "Digital Ops project: WhatsApp messages trigger Spotify playback"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
