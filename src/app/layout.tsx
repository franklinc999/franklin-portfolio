import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Franklin Cheng — Strategist & Product Builder",
  description: "Strategy consultant and product builder. UPenn PPE grad crafting AI-powered tools and go-to-market strategy for Fortune 500 clients.",
  openGraph: {
    title: "Franklin Cheng — Strategist & Product Builder",
    description: "Strategy consultant and product builder. UPenn PPE grad crafting AI-powered tools and go-to-market strategy for Fortune 500 clients.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Instrument Serif from Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* Satoshi from Fontshare */}
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700&display=swap"
          rel="stylesheet"
        />
        {/* GSAP + ScrollTrigger via CDN */}
        <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js"></script>
        <script src="/animations.js" defer></script>
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
