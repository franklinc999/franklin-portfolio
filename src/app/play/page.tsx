import type { Metadata } from "next";
import { Glass, GlassLink } from "@/components/Glass";
import { PageIntro, PageWrapper } from "@/components/Shared";
import { SHOTS } from "@/lib/shots";
import { Zone } from "@/components/Zone";
import { SensConverter } from "@/components/lab/SensConverter";

export const metadata: Metadata = {
  title: "Play",
  description: "Two browser games by Franklin Cheng: Signal // Noise, a designed twin-stick shooter, and Range Warmup, an aim trainer.",
};

export default function PlayHub() {
  return (
    <PageWrapper ground="arcade">
      <Zone theme="arcade" className="zone-last">
        <PageIntro title="Press start" titleClass="h-pixel">
          Two games you can play right here. One is a shooter I designed around a single mechanic. The other is the
          warmup I use before I queue.
        </PageIntro>

        <div className="wrap stack">
          <section className="card-grid two" aria-label="Games">
            <GlassLink href="/play/signal" className="shot">
              <span className="shot-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/shots/signal.jpg" alt={SHOTS.signal} width={1200} height={750} />
              </span>
              <div className="shot-body">
                <h2 className="h2">Signal // Noise</h2>
                <p className="meta">Twin-stick shooter, frequency tuning</p>
                <p>
                  Enemies hide in noise and pulse on a rhythm. Tune your weapon to their band for triple damage. I
                  built it to study telegraphing and how risk and reward stack on a core loop.
                </p>
                <p className="meta">Keyboard and mouse</p>
              </div>
            </GlassLink>
            <GlassLink href="/play/warmup" className="shot">
              <span className="shot-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/shots/warmup.jpg" alt={SHOTS.warmup} width={1200} height={750} />
              </span>
              <div className="shot-body">
                <h2 className="h2">Range Warmup</h2>
                <p className="meta">Reaction, tracking, peek</p>
                <p>
                  A no-frills aim trainer. Match your Call of Duty, Valorant, or Apex sensitivity, then drill the three
                  things that lose gunfights. Recoil and muzzle flash included.
                </p>
                <p className="meta">Mouse required</p>
              </div>
            </GlassLink>
          </section>

          <Glass kind="card" className="demo">
            <div className="demo-head">
              <h2 className="h3">Carry your aim between games</h2>
              <p>
                Every shooter counts mouse movement differently. Enter your settings for one, and get the sensitivity
                that feels the same in the others.
              </p>
            </div>
            <SensConverter />
          </Glass>
        </div>
      </Zone>
    </PageWrapper>
  );
}
