import type { Metadata } from "next";
import localFont from "next/font/local";

export const metadata: Metadata = {
  title: "Live Ops",
  description: "Run eight weeks of a live game that does not exist. A small strategy game by Franklin Cheng.",
};

// This game's own faces, loaded only here: a soft serif for the ledger's headings and figures, a round sans for the rest.
const serif = localFont({ src: "./fonts/Fraunces-Soft-Variable.woff2", variable: "--font-hb-serif", weight: "100 900", display: "swap", preload: false });
const round = localFont({
  src: [
    { path: "./fonts/Nunito-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Nunito-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-hb-round",
  display: "swap",
  preload: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${serif.variable} ${round.variable}`} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
