import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dink",
  description: "3D pickleball against the computer, by Franklin Cheng. Works with a mouse, a finger or the keyboard.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
