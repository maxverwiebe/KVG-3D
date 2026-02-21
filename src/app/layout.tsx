import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";

import "./globals.css";

export const metadata: Metadata = {
  title: "KVG 3D Live Bus Viewer",
  description: "Interaktiver 3D Live-Tracker fur KVG-Busse in Kiel"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
