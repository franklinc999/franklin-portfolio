import type { Metadata } from "next";
import localFont from "next/font/local";

export const metadata: Metadata = {
  title: "Dink",
  description: "3D pickleball by Franklin Cheng. You are a pickle. Across the net is an onion, a carrot or a chili.",
};

// This game's own faces, loaded only here: a fat display face for anything on the scoreboard, and a round sans.
const display = localFont({ src: "./fonts/BowlbyOne-Regular.woff2", variable: "--font-dk-display", weight: "400", display: "swap", preload: false });
const text = localFont({
  src: [
    { path: "./fonts/Rubik-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Rubik-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-dk-text",
  display: "swap",
  preload: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} ${text.variable}`} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
