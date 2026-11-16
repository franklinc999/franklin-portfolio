"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Glass } from "@/components/Glass";
import { PageIntro, PageWrapper } from "@/components/Shared";

// The game leans on browser APIs, so it loads on the client only.
const SignalNoiseGame = dynamic(() => import("@/components/game/SignalNoiseGame"), {
  ssr: false,
  loading: () => (
    <div className="game-loading liquid-glass liquid-glass-border" style={{ aspectRatio: "960 / 600" }}>
      Loading the game
    </div>
  ),
});

const PILLARS = [
  {
    title: "Tune the band",
    body: "Three frequencies: low, mid, high. Match an enemy’s band for triple damage. Mistune and they barely flinch. The wheel, the number keys, or Q and E swap bands instantly.",
  },
  {
    title: "Hidden in the noise",
    body: "Enemies are mostly invisible. They pulse on a rhythm, and that pulse is your read window. Learning to anticipate it replaces traditional aiming difficulty.",
  },
  {
    title: "Chain the score",
    body: "Killing same-band enemies in a row builds a multiplier up to 6x. One mistuned kill resets it. Risk and reward, layered on top of the core loop.",
  },
];

const KEYS = [
  { keys: ["W", "A", "S", "D"], action: "move" },
  { keys: ["Mouse"], action: "aim, click to fire" },
  { keys: ["1", "2", "3"], action: "pick a band" },
  { keys: ["Q", "E", "Wheel"], action: "cycle bands" },
  { keys: ["Space"], action: "start or retry" },
];

export default function SignalPage() {
  return (
    <PageWrapper>
      <PageIntro title="Signal // Noise" back={{ href: "/play", label: "All games" }}>
        A twin-stick decoder I built to study readability, telegraphing, and tuning loops, the fundamentals that make
        shooters feel good.
      </PageIntro>

      <div className="wrap">
        <SignalNoiseGame />
        <ul className="keys on-map" aria-label="Controls">
          {KEYS.map((item) => (
            <li key={item.action}>
              {item.keys.map((key) => (
                <kbd key={key}>{key}</kbd>
              ))}
              <span>{item.action}</span>
            </li>
          ))}
        </ul>
      </div>

      <section className="section wrap" aria-labelledby="loop-title">
        <div className="section-head">
          <h2 id="loop-title" className="h2 on-map">
            Three pillars in one minute
          </h2>
          <Link className="text-link on-map" href="/play/design">
            Read the design doc
          </Link>
        </div>
        <div className="card-grid">
          {PILLARS.map((pillar) => (
            <Glass key={pillar.title} as="article" kind="card" className="tile">
              <h3 className="h3">{pillar.title}</h3>
              <p>{pillar.body}</p>
            </Glass>
          ))}
        </div>
      </section>

      <section className="section wrap" aria-labelledby="why-title">
        <Glass kind="sheet" className="prose">
          <h2 id="why-title" className="h2">
            A small game with a real opinion
          </h2>
          <p>
            I wanted a playable artifact that shows how I think about game systems, not just claims about loving
            games. Signal // Noise is a shooter on purpose, but the frequency-tuning twist makes it about something
            more interesting than an arena clone: telegraph design, sensory readability, risk and reward, and the
            quiet tuning numbers behind game feel.
          </p>
          <p>
            The companion design doc walks through the loop, the tuning targets I picked, the metrics I&rsquo;d
            instrument if this shipped, and the v2 roadmap.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-solid" href="/play/design">
              Read the design doc
            </Link>
            <Link className="btn btn-glass" href="/play/warmup">
              Try Range Warmup
            </Link>
          </div>
        </Glass>
      </section>
    </PageWrapper>
  );
}
