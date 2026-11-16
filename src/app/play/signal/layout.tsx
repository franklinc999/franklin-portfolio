import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Signal // Noise",
  description: "A twin-stick shooter where enemies are sound waves and you tune your weapon to their band. Playable in the browser.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
