"use client";

import Link from "next/link";
import { ArrowUpRight, ArrowLeft } from "lucide-react";
import { Glass } from "@/components/Glass";
import { PageWrapper } from "@/components/Shared";

const TUNING = [
  { label: "Time-to-kill (matched)", value: "0.4-0.6s", note: "3 hits at 3 dmg, 0.13s cadence, fast enough to feel snappy without trivializing aim" },
  { label: "Time-to-kill (mistuned)", value: "~5s", note: "0.4 dmg/hit. Punishing but not impossible, encourages tuning, doesn't lock you out" },
  { label: "Reveal window", value: "~30% of cycle", note: "Pulse curve = sin(phase·2π) clamped, mostly hidden, briefly bright. Trains anticipation, not reaction" },
  { label: "Multiplier ceiling", value: "×6", note: "+1 every 3 same-band kills, decays in 4s. Caps so chains stay readable" },
  { label: "Wave duration", value: "22-30s", note: "Lengthens slightly per wave to avoid back-to-back spawn cliffs" },
  { label: "Player iframes", value: "1.0s", note: "Generous, early-game mistakes shouldn't snowball into instant death" },
];

const ENEMIES = [
  { name: "Drifter", role: "Filler", behavior: "Weaves toward player. Slow pulse (0.45 Hz). Easy to read.", reward: "70 pts" },
  { name: "Stalker", role: "Pressure", behavior: "Direct chase. Faster pulse. Forces the player to keep moving.", reward: "100 pts" },
  { name: "Scrambler", role: "HUD threat", behavior: "Orbits at distance. Pulse scrambles your HUD with red interference. Wave 3+ only.", reward: "250 pts" },
];

const METRICS = [
  { metric: "D1 retention proxy", target: ">40%", how: "% of first-session players who start a second run within 60s of game over" },
  { metric: "Wave 3 reach rate", target: ">35%", how: "% of runs that survive past wave 3, early-game tuning balance check" },
  { metric: "Tuning swap frequency", target: "0.5-1.5/sec", how: "Median band-changes per second of play. Too low = enemies too clustered. Too high = tuner too punishing" },
  { metric: "Mistune ratio", target: "10-25%", how: "Off-band shots ÷ total shots. The desired range for &apos;feels intentional, not perfect&apos;" },
  { metric: "Multiplier engagement", target: "≥30% of runs reach ×3", how: "Confirms the chain mechanic is actually pulled into the moment-to-moment, not just an idle stat" },
];

const ROADMAP = [
  { v: "v1.0", title: "Shipped", body: "Three bands, three enemy types, wave progression, multiplier system, audio feedback, leaderboard local-storage." },
  { v: "v1.1", title: "Game feel polish", body: "Hit-stop tuning, screen shake easing curves, controller support, mobile twin-thumb layout." },
  { v: "v1.2", title: "Run variety", body: "Pickups (auto-tune for 3s, frequency lock, double-fire). Wave modifiers (silence rounds, frequency lock-out events)." },
  { v: "v2.0", title: "Meta progression", body: "Persistent unlocks: alternate weapons (chord-fire that hits two bands), starter perks. Daily seed leaderboard." },
];

const SECTION = "py-10";

export default function DesignDocPage() {
  return (
    <PageWrapper>
      <article className="wrap doc-wrap">
        <Glass kind="sheet" className="game-doc">
        <div className="max-w-3xl mx-auto">
          {/* Title block */}
          <div className="mb-10">
            <Link href="/play/signal" className="back-link inline-flex items-center gap-1.5">
              <ArrowLeft size={14} aria-hidden="true" />
              Back to the game
            </Link>
            <p className="meta mb-3">Design doc, v1.0, April 2026</p>
            <h1 className="h1 mb-5">{"Signal // Noise"}</h1>
            <p className="text-[var(--color-text-muted)] leading-relaxed">
              A 3-minute browser shooter where enemies are sound waves you have to tune into.
              This doc captures the loop, the tuning targets I chose, the metrics I&apos;d instrument
              if this shipped, and the v2 roadmap. Written in the format I&apos;d use for any feature
              spec at work.
            </p>
          </div>

          {/* TL;DR */}
          <Section label="TL;DR">
            <p className="text-[var(--color-text-muted)] leading-relaxed mb-3">
              Twin-stick shooter built around <span className="text-white">one twist</span>:
              enemies are mostly invisible and have a frequency band. Players cycle a tuner
              (cyan / violet / amber) and matched-band shots do triple damage.
            </p>
            <p className="text-[var(--color-text-muted)] leading-relaxed">
              The mechanic forces a constant micro-decision, &quot;is the closest threat worth
              tuning to, or shoot down the cluster I&apos;m already aimed at?&quot;, that creates
              a richer loop than weapon-pickup variety would, with a fraction of the content cost.
            </p>
          </Section>

          {/* Pillars */}
          <Section label="Design Pillars">
            <ul className="space-y-4">
              <Pillar title="Readability over reaction speed.">
                The challenge is reading the field, not pixel-aiming. Pulse cycles train
                anticipation; tuning trades reflex for prioritization.
              </Pillar>
              <Pillar title="One mechanic, deep tuning.">
                No weapon pickups, no skill tree (in v1). All variety comes from how you sequence
                kills. Cheaper to balance, easier to demo, harder to make boring.
              </Pillar>
              <Pillar title="Failure should be readable.">
                Every death should be re-runnable in your head: &quot;mistuned for the scrambler, ate
                the stalker.&quot; If players blame the game, we lose the retry.
              </Pillar>
            </ul>
          </Section>

          {/* Core loop */}
          <Section label="Core Loop">
            <div className="liquid-glass liquid-glass-border rounded-lg p-6">
              <ol className="doc-steps space-y-3 text-[var(--color-text-muted)]">
                <li>Move (avoid contact damage)</li>
                <li>Watch pulse cycles to locate threats</li>
                <li>Tune to dominant nearby band</li>
                <li>Fire matched-band shots, build chain multiplier</li>
                <li>Re-tune as new bands enter range</li>
                <li>Survive 22-30s waves; difficulty escalates speed + density</li>
              </ol>
            </div>
          </Section>

          {/* Tuning */}
          <Section label="Tuning Targets">
            <p className="text-[var(--color-text-muted)] leading-relaxed mb-6">
              Chosen by playtesting against my own intuition for &quot;feels fair, feels fast.&quot; Real
              shipping product would A/B test these.
            </p>
            <div className="space-y-[1px] bg-[var(--color-border)]">
              {TUNING.map((t) => (
                <div key={t.label} className="bg-[var(--color-bg)] p-4 grid grid-cols-1 md:grid-cols-[1fr_auto_2fr] gap-3 md:gap-6 md:items-baseline">
                  <span className="text-sm text-white">{t.label}</span>
                  <span className="font-mono text-sm text-[var(--color-accent)]">{t.value}</span>
                  <span className="text-sm text-[var(--color-text-muted)] leading-relaxed">{t.note}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Enemies */}
          <Section label="Enemy Roster">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {ENEMIES.map((e) => (
                <div key={e.name} className="liquid-glass liquid-glass-border rounded-2xl p-5">
                                    <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-serif text-lg text-white">{e.name}</h3>
                      <span className="meta">
                        {e.role}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-3">{e.behavior}</p>
                    <p className="font-mono text-sm text-[var(--color-accent)]">{e.reward}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Metrics */}
          <Section label="Metrics I'd Instrument">
            <p className="text-[var(--color-text-muted)] leading-relaxed mb-6">
              If this were a real product, these are the dials I&apos;d watch on day one. Targets
              are starting hypotheses, not promises.
            </p>
            <div className="space-y-[1px] bg-[var(--color-border)]">
              {METRICS.map((m) => (
                <div key={m.metric} className="bg-[var(--color-bg)] p-4">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-1">
                    <span className="text-sm text-white">{m.metric}</span>
                    <span className="font-mono text-sm text-[var(--color-accent)]">{m.target}</span>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed" dangerouslySetInnerHTML={{ __html: m.how }} />
                </div>
              ))}
            </div>
          </Section>

          {/* Roadmap */}
          <Section label="Roadmap">
            <div className="space-y-4">
              {ROADMAP.map((r) => (
                <div key={r.v} className="liquid-glass liquid-glass-border rounded-lg p-5">
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="font-mono text-sm text-[var(--color-accent)]">{r.v}</span>
                    <h3 className="font-serif text-lg text-white">{r.title}</h3>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{r.body}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Risks */}
          <Section label="Risks & Mitigations">
            <ul className="space-y-3 text-sm text-[var(--color-text-muted)]">
              <li>
                <span className="text-white">First-session legibility.</span>{" "}
                The tuning mechanic is non-obvious. Mitigation: forced tutorial wave with one
                color of enemy and an inline prompt to switch bands.
              </li>
              <li>
                <span className="text-white">Audio dependence.</span>{" "}
                Players without sound lose context. Mitigation: visual pulse already carries
                primary information; audio is reinforcement, not signal.
              </li>
              <li>
                <span className="text-white">Tuner fatigue.</span>{" "}
                Cycling bands every 2s could feel chore-like. Mitigation: monitor swap-frequency
                metric; if median exceeds ~2/sec, reduce band variety per wave.
              </li>
            </ul>
          </Section>

          {/* Closing */}
          <Section label="Why I Built This">
            <p className="text-[var(--color-text-muted)] leading-relaxed mb-4">
              Saying &quot;I love games&quot; is the cheapest claim in the industry. Building a small
              game with a real opinion about{" "}
              <span className="text-white">why it&apos;s built that way</span>, the tuning calls,
              the failure modes, the things I&apos;d measure if it shipped, is a more honest
              signal, and a more interesting thing to talk about.
            </p>
            <p className="text-[var(--color-text-muted)] leading-relaxed">
              Shipped in roughly a day with Next.js + HTML5 Canvas + Web Audio. No engine,
              no bought assets, no AI-generated art. The constraint was the point.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <Link href="/play/signal" className="btn btn-solid">
                Play it <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
              <a
                href="https://github.com/franklinc999/franklin-portfolio"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-glass"
              >
                Source on GitHub <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            </div>
          </Section>
        </div>
        </Glass>
      </article>
    </PageWrapper>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className={SECTION}>
      <h2 className="doc-h">{label}</h2>
      {children}
    </section>
  );
}

function Pillar({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li>
      <p className="text-white mb-1 font-semibold">{title}</p>
      <p className="text-[var(--color-text-muted)] leading-relaxed">{children}</p>
    </li>
  );
}
