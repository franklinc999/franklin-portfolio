"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Mail, MapPin, GraduationCap, Briefcase, ChevronDown } from "lucide-react";

function LinkedinIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function GithubIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

// ============================================================
// DATA
// ============================================================

const CONSULTING_PROJECTS = [
  {
    client: "Fortune 50 Tech Giant",
    title: "AI Workspace Strategy & Competitive Assessment",
    description:
      "Assessed the client's AI-powered productivity suite against key competitors, identifying capability gaps and growth opportunities. Delivered a strategic roadmap that informed go-to-market decisions and LLM feature prioritization.",
    tags: ["AI Strategy", "Competitive Intelligence", "Go-to-Market"],
    stat: { label: "Market Players Analyzed", value: "12+" },
    span: "col-span-2",
  },
  {
    client: "Global Technology Leader",
    title: "APAC B2B Market Entry",
    description:
      "Developed market entry strategy for B2B expansion across the Asia-Pacific region, analyzing competitive dynamics, regulatory landscapes, and channel partnerships.",
    tags: ["Market Entry", "B2B Strategy", "APAC"],
    stat: { label: "Markets Evaluated", value: "6" },
    span: "col-span-1",
  },
  {
    client: "Leading Financial Services Network",
    title: "Merchant Retention & Network Risk Analysis",
    description:
      "Conducted primary research with merchants to evaluate network switching risk driven by interchange pricing differentials. Found strong retention signals across the portfolio, reinforcing the client's competitive moat.",
    tags: ["Primary Research", "Payments", "Risk Analysis"],
    stat: { label: "Merchant Interviews", value: "40+" },
    span: "col-span-1",
  },
  {
    client: "Leading Financial Services Network",
    title: "Offers & Rewards Competitive Benchmarking",
    description:
      "Benchmarked the client's merchant offers program against competitor pricing models, delivering a comprehensive comparison of incentive structures, fee tiers, and ROI metrics.",
    tags: ["Benchmarking", "Pricing Strategy", "Rewards"],
    stat: { label: "Programs Compared", value: "5" },
    span: "col-span-1",
  },
  {
    client: "Leading Financial Services Network",
    title: "Cross-Border Interchange Pricing Intelligence",
    description:
      "Analyzed interchange pricing structures across Malaysia, India, and South Korea, mapping major issuers and acquirers to identify pricing arbitrage and regulatory risk in each region.",
    tags: ["Interchange", "Cross-Border", "Pricing"],
    stat: { label: "Regional Markets", value: "3" },
    span: "col-span-1",
  },
  {
    client: "Specialty Insurance Carrier (PE-backed)",
    title: "Profitability & Operations Turnaround",
    description:
      "Diagnosed root causes of margin erosion across the client's sales operations. Identified misaligned incentive structures, excessive churn, and product-market gaps relative to competitors, delivering a prioritized remediation plan.",
    tags: ["Operations", "P&L Optimization", "PE Portfolio"],
    stat: { label: "Savings Identified", value: "$2M+" },
    span: "col-span-2",
  },
  {
    client: "Private Equity Fund",
    title: "P2P Software Acquisition Due Diligence",
    description:
      "Led commercial due diligence for a PE client evaluating the acquisition of a peer-to-peer software platform, assessing market positioning, growth trajectory, and competitive defensibility.",
    tags: ["Due Diligence", "M&A", "SaaS"],
    stat: { label: "Deal Assessment", value: "CDD" },
    span: "col-span-1",
  },
  {
    client: "Major Financial Institution",
    title: "Commercial Cards Program Benchmarking",
    description:
      "Currently leading a competitive analysis of commercial card programs across major issuers, evaluating P-Card, virtual card, and B2B payment solutions for procurement and AP use cases.",
    tags: ["Commercial Cards", "B2B Payments", "Active"],
    stat: { label: "Issuers Benchmarked", value: "6" },
    span: "col-span-1",
  },
];

const PROJECTS = [
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
    name: "Automated Grocery Runner",
    year: "2026",
    description:
      "An AI-powered agent that learns your preferences, auto-generates weekly grocery lists, and schedules delivery. Currently in development.",
    link: "#",
    tags: ["AI Agents", "Automation", "Full-Stack"],
    status: "Building",
  },
];

const EXPERIENCES = [
  { company: "Sia Partners (Kaiser Associates)", role: "Associate Consultant", period: "2025 - Present" },
  { company: "RSM", role: "AI Consulting & Strategy", period: "2024" },
  { company: "OptimizeAI", role: "Product Lead (Pre-seed)", period: "2024" },
  { company: "MetaNews", role: "Product & Market Strategy", period: "2023" },
  { company: "Museum of Future Experiences (YC)", role: "Growth & Product", period: "2023" },
];

// ============================================================
// COMPONENTS
// ============================================================

function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 nav-glass rounded-full px-8 py-3 flex items-center gap-8 transition-all duration-300 ${
        scrolled ? "shadow-lg shadow-black/30" : ""
      }`}
    >
      {["About", "Work", "Projects", "Contact"].map((item) => (
        <a
          key={item}
          href={`#${item.toLowerCase()}`}
          className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors duration-200"
        >
          {item}
        </a>
      ))}
    </nav>
  );
}

function Badge() {
  const badgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const badge = badgeRef.current;
    if (!badge) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = badge.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rotateY = ((e.clientX - centerX) / window.innerWidth) * 15;
      const rotateX = ((e.clientY - centerY) / window.innerHeight) * -10;
      badge.style.transform = `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="badge-container relative">
      {/* Lanyard SVG */}
      <svg
        className="absolute left-1/2 -translate-x-1/2 -top-32 w-40 h-36 z-0"
        viewBox="0 0 160 140"
        fill="none"
      >
        <path
          d="M80 0 Q80 60 80 80 Q80 110 80 140"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="2"
          className="lanyard-line"
          fill="none"
        />
        {/* Clip */}
        <rect x="72" y="125" width="16" height="20" rx="3" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <rect x="76" y="130" width="8" height="6" rx="1" fill="rgba(255,255,255,0.15)" />
      </svg>

      {/* Badge Card */}
      <div
        ref={badgeRef}
        className="badge-card liquid-glass liquid-glass-glow rounded-2xl w-[320px] h-[440px] relative overflow-hidden transition-transform duration-100 ease-out"
      >
        {/* Shine overlay */}
        <div className="badge-shine absolute inset-0 z-30 pointer-events-none" />

        {/* Content */}
        <div className="relative z-20 flex flex-col h-full p-6">
          {/* Top section - Photo area */}
          <div className="relative w-full h-44 rounded-xl overflow-hidden mb-4 bg-gradient-to-br from-[rgba(91,184,212,0.15)] to-[rgba(167,139,250,0.1)]">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] opacity-20" />
              <span className="absolute font-serif text-6xl text-white/20 font-normal italic">FC</span>
            </div>
            {/* Security clearance style label */}
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest text-[var(--color-accent)] bg-[rgba(91,184,212,0.1)] border border-[rgba(91,184,212,0.2)]">
              Cleared
            </div>
          </div>

          {/* Name */}
          <h2 className="font-serif text-2xl text-white leading-tight">
            Franklin Cheng
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 font-mono uppercase tracking-wider">
            Strategist & Product Builder
          </p>

          {/* Divider */}
          <div className="w-full h-px bg-gradient-to-r from-transparent via-[var(--color-border-glow)] to-transparent my-4" />

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 flex-1">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-faint)]">Org</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Sia Partners</p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-faint)]">Degree</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">UPenn PPE</p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-faint)]">Focus</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">AI + GTM</p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-faint)]">Location</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Los Angeles</p>
            </div>
          </div>

          {/* Bottom badge ID */}
          <div className="flex items-center justify-between mt-auto pt-3 border-t border-[var(--color-border)]">
            <span className="font-mono text-[10px] text-[var(--color-text-faint)] tracking-widest">ID-FC-2025</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${
                    i <= 4 ? "bg-[var(--color-accent)]" : "bg-[var(--color-text-faint)]"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-[var(--color-accent)] opacity-[0.03] blur-[120px]" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-[var(--color-accent-2)] opacity-[0.03] blur-[120px]" />

      <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24 max-w-6xl mx-auto w-full">
        {/* Left: Text */}
        <div className="flex-1 text-center lg:text-left">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-4 hero-reveal">
            Strategy & Product
          </p>
          <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl text-white leading-[1.05] hero-reveal">
            Franklin
            <br />
            <span className="italic text-[var(--color-accent)]">Cheng</span>
          </h1>
          <p className="mt-6 text-[var(--color-text-muted)] max-w-md text-base leading-relaxed hero-reveal">
            Associate Consultant at Sia Partners building go-to-market strategy
            for Fortune 500 clients. UPenn PPE grad. Shipping AI-powered tools on the side.
          </p>
          <div className="flex items-center gap-4 mt-8 justify-center lg:justify-start hero-reveal">
            <a
              href="#work"
              className="px-6 py-3 rounded-full bg-white/5 border border-[var(--color-border)] text-sm font-medium text-white hover:bg-white/10 hover:border-[var(--color-border-glow)] transition-all duration-300"
            >
              View Work
            </a>
            <a
              href="#contact"
              className="px-6 py-3 rounded-full text-sm font-medium text-[var(--color-text-muted)] hover:text-white transition-colors duration-200"
            >
              Get in Touch
            </a>
          </div>
        </div>

        {/* Right: Badge */}
        <div className="flex-shrink-0 hero-reveal" id="badge-anchor">
          <Badge />
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[var(--color-text-faint)]">
        <span className="text-[10px] font-mono uppercase tracking-widest">Scroll</span>
        <ChevronDown size={14} className="animate-bounce" />
      </div>
    </section>
  );
}

function Marquee() {
  const items = "Strategy · Product · AI · Go-to-Market · Due Diligence · Competitive Intel · Pricing · Operations · ";
  return (
    <div className="py-6 border-y border-[var(--color-border)] overflow-hidden">
      <div className="marquee-track">
        {[0, 1].map((i) => (
          <span
            key={i}
            className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-text-faint)] whitespace-nowrap px-4"
          >
            {items}{items}
          </span>
        ))}
      </div>
    </div>
  );
}

function About() {
  return (
    <section id="about" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-12 items-start">
          {/* Left label */}
          <div className="lg:col-span-2">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-2 scroll-reveal">
              About
            </p>
            <h2 className="font-serif text-3xl lg:text-4xl text-white scroll-reveal">
              Background
            </h2>
          </div>

          {/* Right content */}
          <div className="lg:col-span-3 space-y-6 scroll-reveal">
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

            {/* Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-6 border-t border-[var(--color-border)]">
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-faint)]">Based in</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Los Angeles, CA</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <GraduationCap size={16} className="text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-faint)]">Education</p>
                  <p className="text-sm text-[var(--color-text-muted)]">UPenn, PPE '25</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Briefcase size={16} className="text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-faint)]">Current</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Sia Partners</p>
                </div>
              </div>
            </div>

            {/* Experience Timeline */}
            <div className="pt-6">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-4">
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
      </div>
    </section>
  );
}

function Work() {
  return (
    <section id="work" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12 scroll-reveal">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-2">
            Consulting
          </p>
          <h2 className="font-serif text-3xl lg:text-4xl text-white">
            Selected Engagements
          </h2>
          <p className="mt-3 text-[var(--color-text-muted)] text-sm max-w-lg">
            Client names anonymized per NDA. Outcomes and scope are representative.
          </p>
        </div>

        <div className="bento-section grid grid-cols-1 md:grid-cols-2 gap-[1px] bg-[var(--color-border)]">
          {CONSULTING_PROJECTS.map((project, i) => (
            <div
              key={i}
              className={`bento-item liquid-glass liquid-glass-border rounded-none p-6 ${
                project.span === "col-span-2" ? "md:col-span-2" : ""
              }`}
            >
              <div className="bento-border-glow" />
              <div className="relative z-20">
                {/* Client tag */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-accent)] opacity-80">
                    {project.client}
                  </span>
                  {project.tags.includes("Active") && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      <span className="font-mono text-[10px] text-green-400 uppercase tracking-wider">Active</span>
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="font-serif text-lg text-white mb-2 leading-snug">
                  {project.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4">
                  {project.description}
                </p>

                {/* Bottom: Tags + Stat */}
                <div className="flex items-end justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {project.tags.filter(t => t !== "Active").map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-faint)] border border-[var(--color-border)] rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="stat-value text-xl text-white">{project.stat.value}</p>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-faint)]">
                      {project.stat.label}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Projects() {
  return (
    <section id="projects" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12 scroll-reveal">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-2">
            App Lab
          </p>
          <h2 className="font-serif text-3xl lg:text-4xl text-white">
            Things I&apos;ve Built
          </h2>
          <p className="mt-3 text-[var(--color-text-muted)] text-sm max-w-lg">
            Side projects shipped between client engagements. Most are vibe-coded MVPs -- building towards more complex, polished products.
          </p>
        </div>

        <div className="bento-section grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1px] bg-[var(--color-border)]">
          {PROJECTS.map((project, i) => (
            <a
              key={i}
              href={project.link}
              target={project.link !== "#" ? "_blank" : undefined}
              rel="noopener noreferrer"
              className={`bento-item liquid-glass liquid-glass-border rounded-none p-6 block group ${
                project.link === "#" ? "pointer-events-none" : "cursor-pointer"
              }`}
            >
              <div className="bento-border-glow" />
              <div className="relative z-20 flex flex-col h-full min-h-[200px]">
                {/* Top */}
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

                {/* Title */}
                <h3 className="font-serif text-lg text-white mb-2 leading-snug group-hover:text-[var(--color-accent)] transition-colors duration-200">
                  {project.name}
                </h3>

                {/* Description */}
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4 flex-1">
                  {project.description}
                </p>

                {/* Bottom */}
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
  );
}

function Contact() {
  return (
    <section id="contact" className="py-24 px-6 dot-grid">
      <div className="max-w-3xl mx-auto text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-2 scroll-reveal">
          Contact
        </p>
        <h2 className="font-serif text-3xl lg:text-5xl text-white mb-4 scroll-reveal">
          Let&apos;s talk <span className="italic text-[var(--color-accent)]">next steps</span>
        </h2>
        <p className="text-[var(--color-text-muted)] mb-10 max-w-md mx-auto scroll-reveal">
          Open to strategy, product management, and consulting roles.
          Currently based in Los Angeles.
        </p>

        <div className="flex items-center justify-center gap-4 scroll-reveal">
          <a
            href="mailto:franklinc999@gmail.com"
            className="liquid-glass liquid-glass-border rounded-full px-8 py-3 flex items-center gap-2 text-sm font-medium text-white hover:border-[var(--color-border-glow)] transition-all duration-300 group"
          >
            <Mail size={16} className="group-hover:text-[var(--color-accent)] transition-colors" />
            <span>Email Me</span>
          </a>
          <a
            href="https://www.linkedin.com/in/franklinch/"
            target="_blank"
            rel="noopener noreferrer"
            className="liquid-glass liquid-glass-border rounded-full p-3 hover:border-[var(--color-border-glow)] transition-all duration-300 group"
          >
            <LinkedinIcon size={18} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
          </a>
          <a
            href="https://github.com/franklinc999"
            target="_blank"
            rel="noopener noreferrer"
            className="liquid-glass liquid-glass-border rounded-full p-3 hover:border-[var(--color-border-glow)] transition-all duration-300 group"
          >
            <GithubIcon size={18} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-8 px-6 border-t border-[var(--color-border)]">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <span className="font-mono text-xs text-[var(--color-text-faint)]">
          &copy; {new Date().getFullYear()} Franklin Cheng
        </span>
        <span className="font-mono text-xs text-[var(--color-text-faint)]">
          Built with intention
        </span>
      </div>
    </footer>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function Home() {
  // GSAP animations handled by /animations.js (CDN approach for reliable loading)

  return (
    <main>
      <Nav />
      <Hero />
      <Marquee />
      <About />
      <Work />
      <Marquee />
      <Projects />
      <Contact />
      <Footer />
    </main>
  );
}
