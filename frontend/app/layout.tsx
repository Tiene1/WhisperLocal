import type { Metadata } from "next";
import { IBM_Plex_Sans, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import SideNav from "@/app/components/SideNav";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Speech To Text Local",
  description: "Transcription audio locale via whisper.cpp",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`dark ${ibmPlexSans.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      {/* Next.js hoists <link> tags rendered ici automatiquement dans <head> —
          pattern recommandé App Router pour une police tierce (Material
          Symbols) non gérée par next/font/google. */}
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />
      <body className="bg-bg-base text-on-surface min-h-screen flex font-body-md antialiased">
        <SideNav />
        <div className="flex-1 flex flex-col h-screen overflow-y-auto relative">{children}</div>
      </body>
    </html>
  );
}
