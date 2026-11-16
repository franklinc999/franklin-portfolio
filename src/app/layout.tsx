import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Field } from "@/components/Field";
import { Nav } from "@/components/Nav";
import "./globals.css";

// Archivo, self-hosted. One variable file carries both the weight and width axes.
const archivo = localFont({
  src: "./fonts/Archivo-Variable.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

const description =
  "Franklin Cheng is an associate product manager on Call of Duty at Activision. He manages the in-game store's bundle schedule and builds the automation that audits it.";

export const metadata: Metadata = {
  metadataBase: new URL("https://franklin.rocks"),
  title: {
    default: "Franklin Cheng, product manager on Call of Duty",
    template: "%s | Franklin Cheng",
  },
  description,
  openGraph: {
    title: "Franklin Cheng, product manager on Call of Duty",
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
    <html lang="en" className={archivo.variable}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Field />
        <Nav />
        <div className="app">{children}</div>
      </body>
    </html>
  );
}
