import type { Metadata } from "next";
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "AEGIS — Drone Test Facility",
  description:
    "Inspect and customize the Kestrel X4, fly a timed gate circuit and review recorded telemetry in a procedural 3D test facility.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
