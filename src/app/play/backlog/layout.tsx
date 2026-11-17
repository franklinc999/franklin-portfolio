import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Backlog",
  description: "A 3D boss fight by Franklin Cheng: one arena, one boss, and every attack drawn on the floor before it lands.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
