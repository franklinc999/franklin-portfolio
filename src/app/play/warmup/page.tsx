"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Glass } from "@/components/Glass";
import { PageIntro, PageWrapper } from "@/components/Shared";

const WarmupGame = dynamic(() => import("@/components/game/WarmupGame"), {
  ssr: false,
  loading: () => (
    <div className="game-loading liquid-glass liquid-glass-border" style={{ aspectRatio: "960 / 600" }}>
      Loading the range
    </div>
  ),
});

const DRILLS = [
  {
    title: "Reaction",
    body: "A blank range. Targets flash in random positions and you click them as fast as you can. Your score is your average reaction time in milliseconds, so lower is better.",
  },
  {
    title: "Tracking",
    body: "One target moves unpredictably across the range. Keep the crosshair glued to it. Your score is the share of the round you stayed locked on.",
  },
  {
    title: "Peek",
    body: "You’re behind cover. Hold A or D to lean out, click the targets crossing the lane, and lean back. It trains the muscle memory for jiggle peeks and pre-aim.",
  },
];

export default function WarmupPage() {
  return (
    <PageWrapper>
      <PageIntro title="Range Warmup" back={{ href: "/play", label: "All games" }}>
        A sens-matched warmup for Call of Duty, Valorant, and Apex. Drill reaction time, tracking, and peek mechanics
        before you queue.
      </PageIntro>

      <div className="wrap">
        <WarmupGame />
      </div>

      <section className="section wrap" aria-labelledby="drills-title">
        <div className="section-head">
          <h2 id="drills-title" className="h2 on-map">
            Built for the three things that lose gunfights
          </h2>
        </div>
        <div className="card-grid">
          {DRILLS.map((drill) => (
            <Glass key={drill.title} as="article" kind="card" className="tile">
              <h3 className="h3">{drill.title}</h3>
              <p>{drill.body}</p>
            </Glass>
          ))}
        </div>
      </section>

      <section className="section wrap" aria-labelledby="why-title">
        <Glass kind="sheet" className="prose">
          <h2 id="why-title" className="h2">
            Real sens, real warmup
          </h2>
          <p>
            I wanted a browser warmup that carries over to my real games, and that meant getting the math right.
            Valorant uses a yaw of 0.07 degrees per mouse count, Call of Duty uses 0.0066, and Apex (Source engine)
            uses 0.022. Enter your DPI and in-game sens and the trainer scales mouse input so your cm/360 in the
            browser matches your cm/360 in queue.
          </p>
          <p>Plus a muzzle flash, recoil kick, and camera shake, because dopamine matters.</p>
          <div className="hero-actions">
            <Link className="btn btn-solid" href="/play/signal">
              Try Signal // Noise
            </Link>
            <Link className="btn btn-glass" href="/play">
              All games
            </Link>
          </div>
        </Glass>
      </section>
    </PageWrapper>
  );
}
