import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Range",
  description: "A 3D aim trainer by Franklin Cheng: four drills, with your Valorant, Call of Duty or Apex sensitivity carried over.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
