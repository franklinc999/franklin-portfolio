"use client";

import { lazy, Suspense } from "react";
import { MapPin, GraduationCap, Briefcase, ChevronDown } from "lucide-react";
import { PageWrapper, Marquee } from "@/components/Shared";
import Image from "next/image";

const Badge3D = lazy(() => import("@/components/Badge3D"));

const EXPERIENCES = [
  { company: "Sia Partners (Kaiser Associates)", role: "Associate Consultant", period: "2025 - Present" },
  { company: "RSM", role: "AI Consulting & Strategy", period: "2024" },
  { company: "OptimizeAI", role: "Product Lead (Pre-seed)", period: "2024" },
  { company: "MetaNews", role: "Product & Market Strategy", period: "2023" },
  { company: "Museum of Future Experiences (YC)", role: "Growth & Product", period: "2023" },
];

function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* 3D Canvas */}
      <div className="absolute inset-0 z-0">
        <Suspense
          fallback={
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <Badge3D />
        </Suspense>
      </div>

      {/* Text overlay */}
      <div className="absolute bottom-24 left-8 lg:left-16 z-10 max-w-lg">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-4 hero-reveal">
          Strategy & Product
        </p>
        <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl text-white leading-[1.05] hero-reveal">
          Franklin
          <br />
          <span className="italic text-[var(--color-accent)]">Cheng</span>
        </h1>
        <p className="mt-4 text-[var(--color-text-muted)] max-w-sm text-sm leading-relaxed hero-reveal">
          Associate Consultant at Sia Partners. UPenn PPE. Shipping
          AI-powered tools between client engagements.
        </p>
        <div className="flex items-center gap-4 mt-6 hero-reveal">
          <a
            href="/work"
            className="px-5 py-2.5 rounded-full bg-white/5 border border-[var(--color-border)] text-sm font-medium text-white hover:bg-white/10 hover:border-[var(--color-border-glow)] transition-all duration-300"
          >
            View Work
          </a>
          <a
            href="/contact"
            className="px-5 py-2.5 rounded-full text-sm font-medium text-[var(--color-text-muted)] hover:text-white transition-colors duration-200"
          >
            Get in Touch
          </a>
        </div>
      </div>

      {/* Drag hint */}
      <div className="absolute bottom-24 right-8 lg:right-16 z-10 hero-reveal">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] text-right">
          Drag the badge
        </p>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[var(--color-text-faint)] z-10">
        <span className="text-[10px] font-mono uppercase tracking-widest">Scroll</span>
        <ChevronDown size={14} className="animate-bounce" />
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Centered header */}
        <div className="text-center mb-12">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-2 scroll-reveal">
            About
          </p>
          <h2 className="font-serif text-3xl lg:text-4xl text-white scroll-reveal">
            Background
          </h2>
        </div>

        {/* Photo + Bio centered layout */}
        <div className="flex flex-col items-center gap-10 scroll-reveal">
          {/* Profile photo */}
          <div className="w-40 h-40 rounded-2xl overflow-hidden border border-[var(--color-border)] liquid-glass-border flex-shrink-0">
            <Image
              src="/assets/profile.jpg"
              alt="Franklin Cheng"
              width={160}
              height={160}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Bio text centered */}
          <div className="max-w-2xl text-center space-y-4">
            <p className="text-[var(--color-text-muted)] leading-relaxed">
              From the San Gabriel Valley to UPenn, I studied Philosophy, Politics & Economics with
              minors in Consumer Psychology and East Asian Area Studies -- a foundation that lets me
              see products through the lens of both human behavior and market structure.
            </p>
            <p className="text-[var(--color-text-muted)] leading-relaxed">
              At Sia Partners, I build competitive intelligence and go-to-market strategy for clients
              spanning payments, insurance, and enterprise tech. On the side, I ship lightweight tools
              powered by AI -- because the best product sense comes from building, not just advising.
            </p>
          </div>

          {/* Info Grid centered */}
          <div className="grid grid-cols-3 gap-8 pt-6 border-t border-[var(--color-border)] w-full max-w-lg">
            <div className="flex flex-col items-center gap-2 text-center">
              <MapPin size={16} className="text-[var(--color-accent)]" />
              <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-faint)]">Based in</p>
              <p className="text-sm text-[var(--color-text-muted)]">Los Angeles, CA</p>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <GraduationCap size={16} className="text-[var(--color-accent)]" />
              <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-faint)]">Education</p>
              <p className="text-sm text-[var(--color-text-muted)]">UPenn, PPE &apos;25</p>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <Briefcase size={16} className="text-[var(--color-accent)]" />
              <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-faint)]">Current</p>
              <p className="text-sm text-[var(--color-text-muted)]">Sia Partners</p>
            </div>
          </div>

          {/* Experience Timeline */}
          <div className="w-full max-w-lg pt-6">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-4 text-center">
              Experience
            </p>
            <div className="space-y-3">
              {EXPERIENCES.map((exp, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0"
                >
                  <div>
                    <p className="text-sm text-[var(--color-text)]">{exp.company}</p>
                    <p className="text-xs text-[var(--color-text-faint)]">{exp.role}</p>
                  </div>
                  <span className="font-mono text-xs text-[var(--color-text-faint)]">{exp.period}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <PageWrapper>
      <Hero />
      <Marquee />
      <About />
    </PageWrapper>
  );
}
