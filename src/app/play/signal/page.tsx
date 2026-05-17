"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowUpRight, Gamepad2, Radio, Waves } from "lucide-react";
import { PageWrapper } from "@/components/Shared";

// Game uses browser APIs heavily - load client-only.
const SignalNoiseGame = dynamic(() => import("@/components/game/SignalNoiseGame"), {
  ssr: false,
  loading: () => (
    <div className="w-full max-w-[960px] mx-auto liquid-glass liquid-glass-border rounded-xl flex items-center justify-center" style={{ aspectRatio: "960 / 600" }}>
      <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const PILLARS = [
  {
    icon: Radio,
    title: "Tune the band",
    body: "Three frequencies — LOW, MID, HIGH. Match an enemy's band for 3× damage. Mistune and they barely flinch. The wheel, 1·2·3, or Q/E swaps bands instantly.",
  },
  {
    icon: Waves,
    title: "Hidden in the noise",
    body: "Enemies are mostly invisible. They pulse on a rhythm — that's your read window. Learning to anticipate pulses replaces traditional aiming difficulty.",
  },
  {
    icon: Gamepad2,
    title: "Chain the score",
    body: "Killing same-band enemies in a row builds a multiplier up to ×6. One mistuned kill resets it. Risk-reward layered on top of the core loop.",
  },
];

export default function PlayPage() {
  return (
    <PageWrapper>
      <div className="h-20" />

      <section className="py-10 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8 text-center scroll-reveal">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-2">
              Playable · Browser
            </p>
            <h1 className="font-serif text-4xl lg:text-5xl text-white leading-tight">
              Signal <span className="italic text-[var(--color-accent)]">{"// noise"}</span>
            </h1>
            <p className="mt-3 text-[var(--color-text-muted)] text-sm max-w-xl mx-auto">
              A twin-stick decoder I built to study readability, telegraphing, and tuning loops —
              the design fundamentals that make shooters feel good.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Link
                href="/play/design"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] border border-[var(--color-border)] hover:text-[var(--color-accent)] hover:border-[var(--color-border-glow)] transition-all"
              >
                Read the design doc
                <ArrowUpRight size={12} />
              </Link>
            </div>
          </div>

          {/* Game */}
          <div className="scroll-reveal">
            <SignalNoiseGame />
          </div>

          {/* Quick reference under the canvas */}
          <div className="mt-4 max-w-[960px] mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-faint)]">
            <span><span className="text-[var(--color-text-muted)]">WASD</span> move</span>
            <span><span className="text-[var(--color-text-muted)]">Mouse</span> aim · click fire</span>
            <span><span className="text-[var(--color-text-muted)]">1·2·3</span> bands</span>
            <span><span className="text-[var(--color-text-muted)]">Q · E · Wheel</span> cycle</span>
            <span><span className="text-[var(--color-text-muted)]">Space</span> start / retry</span>
          </div>

          {/* Three pillars */}
          <div className="mt-20 max-w-5xl mx-auto">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-2 text-center scroll-reveal">
              Core loop
            </p>
            <h2 className="font-serif text-3xl text-white text-center mb-10 scroll-reveal">
              Three pillars in one minute
            </h2>
            <div className="bento-section grid grid-cols-1 md:grid-cols-3 gap-[1px] bg-[var(--color-border)]">
              {PILLARS.map(({ icon: Icon, title, body }, i) => (
                <div key={i} className="bento-item liquid-glass liquid-glass-border rounded-none p-6">
                  <div className="bento-border-glow" />
                  <div className="relative z-20">
                    <Icon size={18} className="text-[var(--color-accent)] mb-3" />
                    <h3 className="font-serif text-lg text-white mb-2">{title}</h3>
                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Why it exists */}
          <div className="mt-20 max-w-2xl mx-auto text-center scroll-reveal">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-2">
              Why this exists
            </p>
            <h2 className="font-serif text-3xl text-white mb-6">
              A small game with a <span className="italic text-[var(--color-accent)]">real opinion</span>
            </h2>
            <p className="text-[var(--color-text-muted)] text-sm leading-relaxed mb-4">
              I wanted a playable artifact that shows how I think about game systems — not just
              narrative claims about loving games. Signal // Noise is intentionally a shooter,
              but the frequency-tuning twist makes it about something more interesting than
              &quot;I made an arena clone&quot;: telegraph design, sensory readability, risk-reward
              layering, and the quiet tuning numbers behind game feel.
            </p>
            <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">
              The companion design doc walks through the loop, the tuning targets I picked, the
              metrics I&apos;d instrument if this shipped, and the v2 roadmap.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Link
                href="/play/design"
                className="liquid-glass liquid-glass-border rounded-full px-6 py-2.5 text-sm text-white hover:border-[var(--color-border-glow)] transition-all"
              >
                Read the design doc
              </Link>
              <Link
                href="/projects"
                className="px-6 py-2.5 text-sm text-[var(--color-text-muted)] hover:text-white transition-colors"
              >
                Back to projects
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageWrapper>
  );
}
