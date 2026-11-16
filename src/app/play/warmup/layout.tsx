import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Range Warmup",
  description: "A browser aim trainer that matches your real sensitivity in Valorant, Call of Duty, or Apex.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
