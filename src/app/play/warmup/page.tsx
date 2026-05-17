"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Crosshair, Target, Activity, Eye } from "lucide-react";
import { PageWrapper } from "@/components/Shared";

const WarmupGame = dynamic(() => import("@/components/game/WarmupGame"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full max-w-[960px] mx-auto liquid-glass liquid-glass-border rounded-xl flex items-center justify-center"
      style={{ aspectRatio: "960 / 600" }}
    >
      <div className="w-6 h-6 border-2 border-[var(--color-accent-2)] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const PILLARS = [
  {
    icon: Activity,
    title: "Reaction",
    body: "A blank range. Targets flash in random positions, you click them as fast as humanly possible. Score is your average reaction time in milliseconds. Lower is better.",
  },
  {
    icon: Target,
    title: "Tracking",
    body: "One target moves unpredictably across the range. Your job is to keep the crosshair glued to it. Score is the percentage of the round you were locked on.",
  },
  {
    icon: Eye,
    title: "Peek",
    body: "You're behind cover. Hold A or D to lean out, click the targets crossing the lane, lean back. Trains the muscle memory for jiggle peeks and pre-aim.",
  },
];

export default function WarmupPage() {
  return (
    <PageWrapper>
      <div className="h-20" />

      <section className="py-10 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8 text-center scroll-reveal">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-2">
              FPS Aim Trainer · Browser
            </p>
            <h1 className="font-serif text-4xl lg:text-5xl text-white leading-tight">
              Range <span className="italic text-[var(--color-accent-2)]">warmup</span>
            </h1>
            <p className="mt-3 text-[var(--color-text-muted)] text-sm max-w-xl mx-auto">
              Sens-matched warmup for CoD, Valorant, and Apex. Drill reaction time,
              tracking, and peek mechanics before you queue.
            </p>
          </div>

          {/* Game */}
          <div className="scroll-reveal">
            <WarmupGame />
          </div>

          {/* Three pillars */}
          <div className="mt-20 max-w-5xl mx-auto">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-2 text-center scroll-reveal">
              Three drills
            </p>
            <h2 className="font-serif text-3xl text-white text-center mb-10 scroll-reveal">
              Built for the three things that lose gunfights
            </h2>
            <div className="bento-section grid grid-cols-1 md:grid-cols-3 gap-[1px] bg-[var(--color-border)]">
              {PILLARS.map(({ icon: Icon, title, body }, i) => (
                <div key={i} className="bento-item liquid-glass liquid-glass-border rounded-none p-6">
                  <div className="bento-border-glow" />
                  <div className="relative z-20">
                    <Icon size={18} className="text-[var(--color-accent-2)] mb-3" />
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
              <span className="italic text-[var(--color-accent-2)]">Real sens</span>, real warmup
            </h2>
            <p className="text-[var(--color-text-muted)] text-sm leading-relaxed mb-4">
              I wanted a browser warmup that actually carries over to my real games.
              That meant getting the math right. Valorant uses a yaw of 0.07 deg per
              mouse count, CoD uses 0.0066, and Apex (Source engine) uses 0.022.
              Punch in your DPI and in-game sens, and the trainer scales mouse input so
              your cm/360 in the browser matches your cm/360 in queue.
            </p>
            <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">
              Plus a muzzle flash, recoil kick, and camera shake, because dopamine matters.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Link
                href="/play"
                className="px-6 py-2.5 text-sm text-[var(--color-text-muted)] hover:text-white transition-colors"
              >
                ← Back to games
              </Link>
              <Link
                href="/play/signal"
                className="liquid-glass-border rounded-full px-6 py-2.5 text-sm text-white hover:border-[var(--color-border-glow)] transition-all inline-flex items-center gap-2"
              >
                <Crosshair size={14} />
                Try Signal // Noise
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageWrapper>
  );
}
