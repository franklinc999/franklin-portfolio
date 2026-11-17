import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Ops",
  description: "Run eight weeks of a live game that does not exist. A small strategy game by Franklin Cheng.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
