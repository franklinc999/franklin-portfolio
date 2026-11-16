import type { Metadata } from "next";
import { GlassLink } from "@/components/Glass";
import { PageIntro, PageWrapper } from "@/components/Shared";

export const metadata: Metadata = {
  title: "Play",
  description: "Two browser games by Franklin Cheng: Signal // Noise, a designed twin-stick shooter, and Range Warmup, an aim trainer.",
};

export default function PlayHub() {
  return (
    <PageWrapper>
      <PageIntro title="Two games you can play right here">
        One is a shooter I designed around a single mechanic. The other is the warmup I use before I queue.
      </PageIntro>

      <section className="wrap card-grid play-grid" aria-label="Games">
        <GlassLink href="/play/signal" kind="panel" className="tile play-tile">
          <h2 className="h2">Signal // Noise</h2>
          <p className="meta">Twin-stick shooter, frequency tuning</p>
          <p>
            Enemies hide in noise and pulse on a rhythm. Tune your weapon to their band for triple damage. I built it
            to study telegraphing and how risk and reward stack on a core loop.
          </p>
          <p className="meta">Keyboard and mouse</p>
        </GlassLink>
        <GlassLink href="/play/warmup" kind="panel" className="tile play-tile">
          <h2 className="h2">Range Warmup</h2>
          <p className="meta">Reaction, tracking, peek</p>
          <p>
            A no-frills aim trainer. Match your Call of Duty, Valorant, or Apex sensitivity, then drill the three
            things that lose gunfights. Recoil and muzzle flash included.
          </p>
          <p className="meta">Mouse required</p>
        </GlassLink>
      </section>
    </PageWrapper>
  );
}
