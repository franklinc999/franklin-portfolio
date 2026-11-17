import type { Metadata } from "next";
import localFont from "next/font/local";

export const metadata: Metadata = {
  title: "The Range",
  description: "A 3D aim trainer by Franklin Cheng: four stages on a desert range, with your Valorant, Call of Duty or Apex sensitivity carried over.",
};

// This game's own faces, loaded only here: a stencil for anything painted on, and a narrow sans for the paperwork.
const stencil = localFont({ src: "./fonts/SairaStencilOne-Regular.woff2", variable: "--font-rg-stencil", weight: "400", display: "swap", preload: false });
const narrow = localFont({
  src: [
    { path: "./fonts/SairaCondensed-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/SairaCondensed-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-rg-narrow",
  display: "swap",
  preload: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${stencil.variable} ${narrow.variable}`} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
