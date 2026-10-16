import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cinder Sky — Single-Screen Arcade Defense Game",
  description: "Meteor shards rain onto a mountain valley. Defend six alpine settlements with flak bursts, chain reactions, and workshop upgrades.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#050711] text-slate-100 antialiased overflow-x-hidden">{children}</body>
    </html>
  );
}
