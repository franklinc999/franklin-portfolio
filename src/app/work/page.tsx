import type { Metadata } from "next";
import { Glass } from "@/components/Glass";
import { PageIntro, PageWrapper } from "@/components/Shared";

export const metadata: Metadata = {
  title: "Work",
  description:
    "What Franklin Cheng does as an associate product manager on Call of Duty at Activision: the store schedule, the automation behind it, and launch-night reporting.",
};

const BEFORE = [
  {
    org: "Sia (formerly Kaiser Associates)",
    role: "Associate Consultant",
    when: "Nov 2024 to Jul 2026",
    note: "Competitive intelligence and commercial due diligence for tech, payments, and private equity clients. I designed a testing framework to benchmark four competitor LLM workspace tools for a major tech client, built a bottom-up market sizing model that validated a $9B TAM for a Fortune 500 client’s new credit vertical, and automated a data-entry bottleneck the team kept using on later engagements.",
  },
  {
    org: "RSM",
    role: "AI Consulting Intern",
    when: "Jun to Aug 2024",
    note: "Co-led research and execution of an internal generative AI feature, running A/B tests with engineers and feedback from 300+ beta testers, which cut report writing time by 30%. Launched four Power BI dashboards tracking feature adoption for 90+ sales and ops leaders.",
  },
  {
    org: "Meta News",
    role: "Product and Strategy",
    when: "Sep 2022 to May 2024",
    note: "Launched an in-app LLM product at NFT.NYC 2024 as the event’s primary sponsor, covering pricing, positioning, and go-to-market, with 10,000 signups in one week. Built a real-time tracker that sorted 500+ articles a day by sentiment and topic.",
  },
];

export default function WorkPage() {
  return (
    <PageWrapper>
      <PageIntro title="Keeping a live store on schedule">
        I&rsquo;m an associate product manager on Call of Duty at Activision, since August 2026. The job is part
        schedule, part analysis, and a growing part automation I build myself.
      </PageIntro>

      <section className="wrap work-grid" aria-label="Call of Duty work">
        <Glass as="article" className="work-item wide">
          <div className="stat">
            <p className="fig">140+</p>
            <p className="fig-label">bundles on one schedule</p>
          </div>
          <div className="body">
            <h2 className="h3">The store schedule</h2>
            <p>
              I manage the Call of Duty in-game store bundle schedule, the source cross-functional teams use for
              go-live dates. I replaced hand-typed release dates with formula-driven logic across 583 rows and added
              daily automated audits that flag mismatches against the live CMS.
            </p>
          </div>
        </Glass>

        <Glass as="article" kind="card" className="work-item">
          <div className="stat">
            <p className="fig">27</p>
            <p className="fig-label">scheduled pipelines</p>
          </div>
          <div className="body">
            <h2 className="h3">Agents that do the pulling</h2>
            <p>
              I designed and built a multi-agent automation system in SQL, Python, and Node.js. It pulls Databricks
              data, audits the store schedule, and generates leadership decks and reports, saving an estimated eight
              hours a week of manual data pulls and deck building.
            </p>
          </div>
        </Glass>

        <Glass as="article" kind="card" className="work-item">
          <div className="stat">
            <p className="fig">Hourly</p>
            <p className="fig-label">through launch night</p>
          </div>
          <div className="body">
            <h2 className="h3">Launch-night reporting</h2>
            <p>
              For launch night I built an unattended hourly report that benchmarks the new title against prior ones
              for a ten-person live-ops performance channel. After the first post went out, it was extended to run
              overnight.
            </p>
          </div>
        </Glass>

        <Glass as="article" kind="card" className="work-item">
          <div className="stat">
            <p className="fig">20</p>
            <p className="fig-label">automated tests on the pipelines</p>
          </div>
          <div className="body">
            <h2 className="h3">Catching silent failures</h2>
            <p>
              Every pipeline has failure detection and alerting: watchdogs, data freshness checks, and automated
              tests. Stale or broken data gets flagged before it reaches a launch readout.
            </p>
          </div>
        </Glass>

        <Glass as="article" kind="card" className="work-item">
          <div className="stat">
            <p className="fig">4</p>
            <p className="fig-label">Call of Duty titles compared</p>
          </div>
          <div className="body">
            <h2 className="h3">Bundle analysis and readouts</h2>
            <p>
              I analyze bundle performance in Databricks for leadership readouts, looking at day-one sales, equip
              rates, and revenue per daily active user, and I draft bundle pricing. I also built an automated Season 2
              bundle visualization deck covering 21 bundles, and a five-slide store post mortem for a development
              studio review.
            </p>
          </div>
        </Glass>
      </section>

      <section className="section wrap" aria-labelledby="before-title">
        <div className="section-head">
          <h2 id="before-title" className="h2 on-map">
            Before games
          </h2>
        </div>
        <Glass kind="sheet" className="prose">
          <ol className="timeline">
            {BEFORE.map((item) => (
              <li key={item.org}>
                <span className="org">{item.org}</span>
                <span className="when">{item.when}</span>
                <span className="role">{item.role}</span>
                <p className="note">{item.note}</p>
              </li>
            ))}
          </ol>
        </Glass>
      </section>
    </PageWrapper>
  );
}
