"use client";

import { PageWrapper, Marquee } from "@/components/Shared";

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

export default function WorkPage() {
  return (
    <PageWrapper>
      {/* Spacer for fixed nav */}
      <div className="h-20" />

      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12 scroll-reveal text-center">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-2">
              Consulting
            </p>
            <h1 className="font-serif text-4xl lg:text-5xl text-white">
              Selected Engagements
            </h1>
            <p className="mt-3 text-[var(--color-text-muted)] text-sm max-w-lg mx-auto">
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
                  <h3 className="font-serif text-lg text-white mb-2 leading-snug">
                    {project.title}
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4">
                    {project.description}
                  </p>
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

      <Marquee />
    </PageWrapper>
  );
}
