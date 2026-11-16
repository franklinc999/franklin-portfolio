import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Field } from "@/components/Field";
import { MotionToggle } from "@/components/MotionToggle";
import { Nav } from "@/components/Nav";
import "./globals.css";

// Archivo carries the site: one variable file with both weight and width axes.
const archivo = localFont({
  src: "./fonts/Archivo-Variable.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

// The accent faces. Each belongs to one zone, so none of them is preloaded.
const newsreader = localFont({
  src: [
    { path: "./fonts/Newsreader-Variable.woff2", weight: "200 800", style: "normal" },
    { path: "./fonts/Newsreader-Italic-Variable.woff2", weight: "200 800", style: "italic" },
  ],
  variable: "--font-newsreader",
  display: "swap",
  preload: false,
});

const caveat = localFont({
  src: "./fonts/Caveat-Variable.woff2",
  variable: "--font-caveat",
  weight: "400 700",
  display: "swap",
  preload: false,
});

const jersey = localFont({
  src: "./fonts/Jersey25-Regular.woff2",
  variable: "--font-jersey",
  weight: "400",
  display: "swap",
  preload: false,
});

const description =
  "Franklin Cheng works on Call of Duty at Activision, builds AI agents on the side, and makes small games to learn how good ones feel.";

export const metadata: Metadata = {
  metadataBase: new URL("https://franklin.rocks"),
  title: {
    default: "Franklin Cheng: product, agents, games",
    template: "%s | Franklin Cheng",
  },
  description,
  openGraph: {
    title: "Franklin Cheng: product, agents, games",
    description,
    url: "https://franklin.rocks",
    siteName: "Franklin Cheng",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  themeColor: "#05172a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${archivo.variable} ${newsreader.variable} ${caveat.variable} ${jersey.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Field />
        <Nav />
        <MotionToggle />
        <div className="app">{children}</div>
      </body>
    </html>
  );
}
