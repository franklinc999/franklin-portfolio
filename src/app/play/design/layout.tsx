import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Signal // Noise design doc",
  description: "The design doc behind Signal // Noise: the core mechanic and the tuning numbers behind how it feels.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
