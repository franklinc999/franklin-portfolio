import type { Metadata } from "next";
import { Glass, GlassLink } from "@/components/Glass";
import { PageIntro, PageWrapper } from "@/components/Shared";
import { SHOTS } from "@/lib/shots";
import { Zone } from "@/components/Zone";
import { AgentLine } from "@/components/lab/AgentLine";
import { SlabAnatomy } from "@/components/lab/SlabAnatomy";

export const metadata: Metadata = {
  title: "Projects",
  description: "Things Franklin Cheng has built: two browser games, an interview copilot, and a handful of small tools.",
};

type Project = {
  name: string;
  year: string;
  description: string;
  link: string;
  state: "live" | "building";
};

const MORE: Project[] = [
  {
    name: "Interview Copilot",
    year: "2026",
    description:
      "A real-time copilot for meetings and interviews. It listens in, surfaces relevant context, and suggests responses on the fly.",
    link: "https://interview-copilot.pplx.app",
    state: "live",
  },
  {
    name: "Automated Grocery Runner",
    year: "2026",
    description: "An agent that learns what I buy, writes the weekly grocery list, and schedules delivery.",
    link: "",
    state: "building",
  },
  {
    name: "Three Good Things",
    year: "2025",
    description:
      "A gratitude journal I built during a rough patch. Log three good moments a day, with a year-end recap planned.",
    link: "https://steep-frost-2548.21st.app/",
    state: "live",
  },
  {
    name: "Did You Call Your Parents?",
    year: "2025",
    description: "A reminder app born from not calling home for two months. Gentle nudges to stay in touch with family.",
    link: "https://noisy-sky-5988.21st.app/",
    state: "live",
  },
  {
    name: "Rate My Resume",
    year: "2024",
    description: "A resume grader for internship applicants who want a quick sense check before they hit submit.",
    link: "https://resume-grader-0986b991.base44.app/",
    state: "live",
  },
  {
    name: "OptimizeAI Dashboard",
    year: "2024",
    description: "An analytics dashboard for a pre-seed AI startup, showing model performance and user engagement.",
    link: "https://optimizeai.net/",
    state: "live",
  },
  {
    name: "GPA Calculator",
    year: "2023",
    description: "Works out the exact final grade you need to hit a target GPA. Built for stressed undergrads.",
    link: "https://empty-smoke-6977.21st.app/",
    state: "live",
  },
];

const HERE = [
  { name: "The agent line", where: "/#workshop", description: "A toy pipeline you can break, to show why the checks around an agent matter more than the agent." },
  { name: "Sensitivity converter", where: "/#arcade", description: "Carries your mouse sensitivity from one shooter to another by matching the distance of a full turn." },
  { name: "Gongfu timer", where: "/#off-the-clock", description: "Counts tea steeps in a glass cup that fills as the seconds run." },
];

function Row({ project }: { project: Project }) {
  const body = (
    <>
      <h3 className="h3">{project.name}</h3>
      <p>{project.description}</p>
      <p className="meta">
        <span className="status" data-state={project.state}>
          {project.state === "live" ? project.year : `Building, ${project.year}`}
        </span>
      </p>
    </>
  );
  if (!project.link) return <li className="row">{body}</li>;
  return (
    <li>
      <a className="row" href={project.link} target="_blank" rel="noopener noreferrer">
        {body}
      </a>
    </li>
  );
}

export default function ProjectsPage() {
  return (
    <PageWrapper ground="blueprint">
      <Zone theme="blueprint" className="zone-last">
        <PageIntro title="Things I’ve built" titleClass="h1">
          Side projects, made on nights and weekends. Most are small on purpose: the point is to learn what a product
          needs by shipping one.
        </PageIntro>

        <div className="wrap stack">
          <section className="card-grid two" aria-label="Games">
            <GlassLink href="/play/signal" className="shot">
              <span className="shot-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/shots/signal.jpg" alt={SHOTS.signal} width={1200} height={750} />
              </span>
              <div className="shot-body">
                <h2 className="h3">Signal // Noise</h2>
                <p>
                  A twin-stick shooter where enemies are sound waves you tune your weapon to. I built it to study
                  readability, telegraphing, and the tuning numbers behind game feel. It ships with a full design doc.
                </p>
                <p className="meta">Game, canvas and Web Audio, 2026</p>
              </div>
            </GlassLink>
            <GlassLink href="/play/warmup" className="shot">
              <span className="shot-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/shots/warmup.jpg" alt={SHOTS.warmup} width={1200} height={750} />
              </span>
              <div className="shot-body">
                <h2 className="h3">Range Warmup</h2>
                <p>
                  A browser aim trainer that matches your real game sensitivity. Pick Valorant, Call of Duty, or Apex,
                  enter your DPI and sens, and the cm/360 math scales mouse input so muscle memory carries over.
                </p>
                <p className="meta">Game, canvas, 2026</p>
              </div>
            </GlassLink>
          </section>

          <section aria-labelledby="line-title">
            <Glass kind="sheet" className="demo">
              <div className="demo-head">
                <p className="annot">fig. 1: a toy model, not a real system</p>
                <h2 id="line-title" className="h3">
                  Try to break this pipeline
                </h2>
                <p>
                  The way I think about agents, as something you can poke. Send a bad task, switch the checker off, or
                  stall the writer, and watch what the line does about it.
                </p>
              </div>
              <AgentLine />
            </Glass>
          </section>

          <section id="glass" aria-labelledby="glass-title">
            <Glass kind="sheet" className="demo">
              <div className="demo-head">
                <p className="annot">fig. 2: the glass on this site</p>
                <h2 id="glass-title" className="h3">
                  How the glass works
                </h2>
                <p>
                  None of the glass here is a blur filter. One shader draws the ground and every slab on it, and bends
                  the ground under each slab&rsquo;s rim the way a thick lens would. The numbers below are read from
                  the running code.
                </p>
              </div>
              <SlabAnatomy />
            </Glass>
          </section>

          <section aria-labelledby="more-title">
            <div className="section-head">
              <h2 id="more-title" className="h2 on-map">
                Tools and experiments
              </h2>
            </div>
            <Glass kind="sheet" className="rows">
              <ul>
                {MORE.map((project) => (
                  <Row key={project.name} project={project} />
                ))}
              </ul>
            </Glass>
          </section>

          <section aria-labelledby="here-title">
            <div className="section-head">
              <h2 id="here-title" className="h2 on-map">
                Built into this site
              </h2>
            </div>
            <div className="card-grid">
              {HERE.map((item) => (
                <GlassLink key={item.name} href={item.where} className="tile">
                  <h3 className="h3">{item.name}</h3>
                  <p>{item.description}</p>
                  <p className="meta">On the home page</p>
                </GlassLink>
              ))}
            </div>
          </section>
        </div>
      </Zone>
    </PageWrapper>
  );
}
