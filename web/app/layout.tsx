import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
import "./globals.css";
import { TopBar } from "./components/TopBar";
import { currentAiMode } from "../lib/ai-mode-cookie";

// Dark glass (S23, D3): Geist for every word on screen.
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Inter is only the fallback after Geist, so it is not preloaded.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Pill Desk",
  description:
    "Pill Desk: turning building engineers' know-how into reusable, governed Intelligence Pills. Made up for the hackathon demo.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const aiMode = await currentAiMode();

  return (
    <html lang="en" className={`${geist.variable} ${inter.variable}`}>
      <body>
        <TopBar aiMode={aiMode} />
        {children}
      </body>
    </html>
  );
}
