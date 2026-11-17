import type { Metadata } from "next";
import localFont from "next/font/local";

export const metadata: Metadata = {
  title: "The Backlog",
  description: "A 3D boss fight on a desk, by Franklin Cheng. You are three centimetres tall. It is a stack of sticky notes.",
};

// This game has its own two faces, loaded only here: a marker for anything shouted, a typewriter for anything filed.
const marker = localFont({ src: "./fonts/PermanentMarker-Regular.woff2", variable: "--font-bk-marker", weight: "400", display: "swap", preload: false });
const typed = localFont({ src: "./fonts/SpecialElite-Regular.woff2", variable: "--font-bk-typed", weight: "400", display: "swap", preload: false });

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${marker.variable} ${typed.variable}`} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
