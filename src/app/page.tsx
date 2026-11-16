import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Glass, GlassLink } from "@/components/Glass";
import { HeroName } from "@/components/HeroName";
import { Contact, PageWrapper } from "@/components/Shared";

const EXPERIENCE = [
  { org: "Activision", role: "Associate Product Manager, Call of Duty", when: "2026 to now" },
  { org: "Sia (formerly Kaiser Associates)", role: "Associate Consultant", when: "2024 to 2026" },
  { org: "RSM", role: "AI Consulting Intern", when: "2024" },
  { org: "OptimizeAI", role: "Product Lead, pre-seed", when: "2024" },
  { org: "Meta News", role: "Product and Strategy", when: "2022 to 2024" },
  { org: "Museum of Future Experiences (YC)", role: "Growth and Product", when: "2023" },
];

export default function Home() {
  return (
    <PageWrapper>
      <section className="hero">
        <Badge />
        <div className="hero-copy wrap">
          <HeroName lines={["Franklin", "Cheng"]} />
          <p className="lede on-map">
            Associate product manager on Call of Duty at Activision. I manage the in-game store&rsquo;s bundle
            schedule and build the automation that audits it, reports on it, and catches bad data before it reaches a
            readout.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-solid" href="/work">
              See the work
            </Link>
            <Link className="btn btn-glass" href="/play">
              Play a game I built
            </Link>
          </div>
        </div>
      </section>

      <section className="section wrap" aria-labelledby="now-title">
        <div className="section-head">
          <h2 id="now-title" className="h2 on-map">
            What I do at Activision
          </h2>
          <Link className="text-link on-map" href="/work">
            All of the work
          </Link>
        </div>
        <div className="now-grid">
          <Glass as="article" className="tile">
            <p className="fig">140+</p>
            <h3 className="h3">Bundles on one schedule</h3>
            <p>
              The in-game store schedule is where other teams get their go-live dates, and I manage it. I replaced its
              hand-typed release dates with formulas and added a daily audit against the live CMS.
            </p>
          </Glass>
          <Glass as="article" kind="card" className="tile">
            <p className="fig">27</p>
            <h3 className="h3">Scheduled pipelines</h3>
            <p>
              A multi-agent system in SQL, Python, and Node.js. It pulls Databricks data, checks the schedule, and
              writes the decks and reports leadership reads.
            </p>
          </Glass>
          <Glass as="article" kind="card" className="tile">
            <p className="fig">Hourly</p>
            <h3 className="h3">Launch-night reporting</h3>
            <p>
              An unattended report that benchmarks a launch against prior titles for the live-ops performance channel,
              all through the night.
            </p>
          </Glass>
        </div>
      </section>

      <section className="section wrap" aria-labelledby="side-title">
        <div className="section-head">
          <h2 id="side-title" className="h2 on-map">
            Built on the side
          </h2>
          <Link className="text-link on-map" href="/projects">
            All projects
          </Link>
        </div>
        <div className="card-grid">
          <GlassLink href="/play/warmup" className="tile">
            <h3 className="h3">Range Warmup</h3>
            <p>
              A browser aim trainer that matches your real sensitivity in Valorant, Call of Duty, or Apex, so the
              muscle memory carries over.
            </p>
            <p className="meta">Playable in the browser</p>
          </GlassLink>
          <GlassLink href="/play/signal" className="tile">
            <h3 className="h3">Signal // Noise</h3>
            <p>
              A twin-stick shooter where enemies are sound waves and you tune your weapon to their band. It ships with
              its design doc.
            </p>
            <p className="meta">Playable in the browser</p>
          </GlassLink>
          <GlassLink href="https://interview-copilot.pplx.app" className="tile">
            <h3 className="h3">Interview Copilot</h3>
            <p>
              A real-time copilot for interviews and meetings. It listens in, surfaces context, and suggests what to
              say next.
            </p>
            <p className="meta">Opens in a new tab</p>
          </GlassLink>
        </div>
      </section>

      <section className="section wrap about" aria-labelledby="about-title">
        <Glass kind="sheet" className="prose">
          <h2 id="about-title" className="h2">
            Background
          </h2>
          <p>
            I grew up in the San Gabriel Valley and studied Philosophy, Politics and Economics at Penn, with minors in
            Consumer Psychology and East Asian Area Studies. That mix is why I look at a product from two sides: how
            people behave, and how the market around them is built.
          </p>
          <p>
            Before games I was a strategy consultant at Sia (formerly Kaiser Associates), working on competitive
            intelligence, market sizing, and commercial due diligence. I kept building tools on the side, and in 2026
            I moved to Activision to work on a game I play.
          </p>
          <p>
            Off the clock it&rsquo;s Valorant, League of Legends, cooking, tea, and pickleball. I speak English and
            Mandarin.
          </p>
        </Glass>
        <Glass kind="card" className="prose">
          <h2 className="h3">Experience</h2>
          <ol className="timeline">
            {EXPERIENCE.map((item) => (
              <li key={item.org}>
                <span className="org">{item.org}</span>
                <span className="when">{item.when}</span>
                <span className="role">{item.role}</span>
              </li>
            ))}
          </ol>
        </Glass>
      </section>

      <div className="section wrap">
        <Contact />
      </div>
    </PageWrapper>
  );
}
