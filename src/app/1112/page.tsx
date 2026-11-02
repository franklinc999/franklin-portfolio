import type { Metadata } from "next";
import Gift from "./Gift";

export const metadata: Metadata = {
  title: "11 . 12",
  description: "for you",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function Page() {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Homemade+Apple&family=VT323&display=swap"
        precedence="default"
      />
      <Gift />
    </>
  );
}
