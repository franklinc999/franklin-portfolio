"use client";

import Link from "next/link";
import { ArrowUpRight, Radio, Crosshair } from "lucide-react";
import { PageWrapper } from "@/components/Shared";

export default function PlayHub() {
  return (
    <PageWrapper>
      <div className="h-20" />

      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12 text-center scroll-reveal">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-2">
              Playable
            </p>
            <h1 className="font-serif text-4xl lg:text-5xl text-white">
              Pick your <span className="italic text-[var(--color-accent)]">range</span>
            </h1>
            <p className="mt-3 text-[var(--color-text-muted)] text-sm max-w-lg mx-auto">
              Two games in the browser. One is a designed shooter. The other is a no-nonsense FPS warmup.
            </p>
          </div>

          <div className="bento-section grid grid-cols-1 md:grid-cols-2 gap-[1px] bg-[var(--color-border)]">
            {/* Signal // Noise */}
            <Link
              href="/play/signal"
              className="bento-item liquid-glass liquid-glass-border rounded-none p-8 block group min-h-[280px]"
            >
              <div className="bento-border-glow" />
              <div className="relative z-20 flex flex-col h-full">
                <div className="flex items-center justify-between mb-6">
                  <Radio size={20} className="text-[var(--color-accent)]" />
                  <ArrowUpRight size={14} className="text-[var(--color-text-faint)] group-hover:text-[var(--color-accent)] transition-colors" />
                </div>
                <h2 className="font-serif text-2xl text-white mb-2 group-hover:text-[var(--color-accent)] transition-colors">
                  Signal {"// noise"}
                </h2>
                <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-faint)] mb-4">
                  Twin-stick · Frequency tuning
                </p>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed flex-1">
                  A designed arena shooter. Enemies hide in noise and pulse on rhythm. Tune your weapon to their band for 3x damage. Built to study telegraph design and risk-reward layering.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-6">
                  {["Twin-Stick", "Rhythm", "Designed"].map((tag) => (
                    <span key={tag} className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-faint)] border border-[var(--color-border)] rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Link>

            {/* Warmup */}
            <Link
              href="/play/warmup"
              className="bento-item liquid-glass liquid-glass-border rounded-none p-8 block group min-h-[280px]"
            >
              <div className="bento-border-glow" />
              <div className="relative z-20 flex flex-col h-full">
                <div className="flex items-center justify-between mb-6">
                  <Crosshair size={20} className="text-[var(--color-accent-2)]" />
                  <ArrowUpRight size={14} className="text-[var(--color-text-faint)] group-hover:text-[var(--color-accent-2)] transition-colors" />
                </div>
                <h2 className="font-serif text-2xl text-white mb-2 group-hover:text-[var(--color-accent-2)] transition-colors">
                  Range <span className="italic">warmup</span>
                </h2>
                <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-faint)] mb-4">
                  Reaction · Tracking · Peek
                </p>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed flex-1">
                  A no-frills aim trainer. Match your CoD / Val / Apex sensitivity, then drill reaction, tracking, and peek mechanics before queue. Recoil and muzzle flash for the dopamine.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-6">
                  {["Aim Trainer", "Sens-Matched", "CoD/Val/Apex"].map((tag) => (
                    <span key={tag} className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-faint)] border border-[var(--color-border)] rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </PageWrapper>
  );
}
