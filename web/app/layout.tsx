import type { Metadata } from "next";
import { Chakra_Petch, Inter } from "next/font/google";
import "./globals.css";
import { TopBar } from "./components/TopBar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const chakraPetch = Chakra_Petch({
  variable: "--font-hud-family",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Pill Desk",
  description:
    "Pill Desk: turning building engineers' know-how into reusable, governed Intelligence Pills. Made up for the hackathon demo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${chakraPetch.variable}`}>
      <body>
        <TopBar />
        {children}
      </body>
    </html>
  );
}
