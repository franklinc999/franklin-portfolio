"use client";

import { ArrowUpRight } from "lucide-react";
import { PageWrapper, Marquee } from "@/components/Shared";

const PROJECTS = [
  {
    name: "Signal // Noise",
    year: "2026",
    description:
      "A twin-stick browser shooter where enemies are sound waves you have to tune your weapon to. Built to study readability, telegraphing, and the tuning numbers behind game feel — ships with a full PM design doc.",
    link: "/play",
    tags: ["Game Design", "Canvas", "Web Audio"],
    status: "Live",
  },
  {
    name: "Three Good Things",
    year: "2025",
    description:
      "A gratitude journaling app built during a rough patch. Log three positive moments daily with plans for a year-end Wrapped-style tracker.",
    link: "https://steep-frost-2548.21st.app/",
    tags: ["React", "AI", "Wellness"],
    status: "Live",
  },
  {
    name: "Did You Call Your Parents?",
    year: "2025",
    description:
      "A guilt-powered reminder app born from not calling home for two months. Gentle nudges to stay connected with family.",
    link: "https://noisy-sky-5988.21st.app/",
    tags: ["React", "Notifications", "Personal"],
    status: "Live",
  },
  {
    name: "Rate My Resume",
    year: "2024",
    description:
      "An AI resume grader for internship applicants who want a quick sense-check before hitting submit.",
    link: "https://resume-grader-0986b991.base44.app/",
    tags: ["AI", "NLP", "Career Tools"],
    status: "Live",
  },
  {
    name: "OptimizeAI Dashboard",
    year: "2024",
    description:
      "A full analytics dashboard built for a pre-seed AI startup, visualizing model performance and user engagement metrics.",
    link: "https://optimizeai.net/",
    tags: ["Dashboard", "Analytics", "Startup"],
    status: "Live",
  },
  {
    name: "GPA Calculator",
    year: "2023",
    description:
      "A minimal tool to calculate the exact final grade needed to hit your target GPA. Built for stressed-out undergrads.",
    link: "https://empty-smoke-6977.21st.app/",
    tags: ["Utility", "Education", "Tool"],
    status: "Live",
  },
  {
    name: "Interview Copilot",
    year: "2026",
    description:
      "A real-time meeting and interview copilot that listens in, surfaces relevant context, and suggests responses on the fly. Built for high-stakes calls where you can't afford to fumble.",
    link: "https://interview-copilot.pplx.app",
    tags: ["AI", "Real-Time", "Productivity"],
    status: "Live",
  },
  {
    name: "Automated Grocery Runner",
    year: "2026",
    description:
      "An AI-powered agent that learns your preferences, auto-generates weekly grocery lists, and schedules delivery. Currently in development.",
    link: "#",
    tags: ["AI Agents", "Automation", "Full-Stack"],
    status: "Building",
  },
];

export default function ProjectsPage() {
  return (
    <PageWrapper>
      <div className="h-20" />

      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12 scroll-reveal text-center">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-2">
              App Lab
            </p>
            <h1 className="font-serif text-4xl lg:text-5xl text-white">
              Things I&apos;ve Built
            </h1>
            <p className="mt-3 text-[var(--color-text-muted)] text-sm max-w-lg mx-auto">
              Side projects shipped between client engagements. Most are vibe-coded MVPs -- building towards more complex, polished products.
            </p>
          </div>

          <div className="bento-section grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1px] bg-[var(--color-border)]">
            {PROJECTS.map((project, i) => (
              <a
                key={i}
                href={project.link}
                target={project.link !== "#" && !project.link.startsWith("/") ? "_blank" : undefined}
                rel="noopener noreferrer"
                className={`bento-item liquid-glass liquid-glass-border rounded-none p-6 block group ${
                  project.link === "#" ? "pointer-events-none" : "cursor-pointer"
                }`}
              >
                <div className="bento-border-glow" />
                <div className="relative z-20 flex flex-col h-full min-h-[200px]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)]">
                      {project.year}
                    </span>
                    <span
                      className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${
                        project.status === "Live"
                          ? "text-[var(--color-accent)] border-[rgba(91,184,212,0.2)] bg-[rgba(91,184,212,0.05)]"
                          : "text-[var(--color-accent-2)] border-[rgba(167,139,250,0.2)] bg-[rgba(167,139,250,0.05)]"
                      }`}
                    >
                      {project.status}
                    </span>
                  </div>
                  <h3 className="font-serif text-lg text-white mb-2 leading-snug group-hover:text-[var(--color-accent)] transition-colors duration-200">
                    {project.name}
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4 flex-1">
                    {project.description}
                  </p>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex flex-wrap gap-1.5">
                      {project.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-faint)] border border-[var(--color-border)] rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    {project.link !== "#" && (
                      <ArrowUpRight
                        size={14}
                        className="text-[var(--color-text-faint)] group-hover:text-[var(--color-accent)] transition-colors duration-200 flex-shrink-0 ml-2"
                      />
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <Marquee />
    </PageWrapper>
  );
}
