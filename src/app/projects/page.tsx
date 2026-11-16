import type { Metadata } from "next";
import { Glass, GlassLink } from "@/components/Glass";
import { PageIntro, PageWrapper } from "@/components/Shared";

export const metadata: Metadata = {
  title: "Projects",
  description: "Side projects by Franklin Cheng: two browser games, an interview copilot, and a handful of small tools.",
};

type Project = {
  name: string;
  year: string;
  description: string;
  link: string;
  kind: string;
  state: "live" | "building";
};

const FEATURED: Project[] = [
  {
    name: "Range Warmup",
    year: "2026",
    description:
      "A browser aim trainer that matches your real game sensitivity. Pick Valorant, Call of Duty, or Apex, enter your DPI and in-game sens, and the cm/360 math scales mouse input so muscle memory carries over. Three drills: reaction, tracking, and a third-person peek mode.",
    link: "/play/warmup",
    kind: "Game, canvas",
    state: "live",
  },
  {
    name: "Signal // Noise",
    year: "2026",
    description:
      "A twin-stick shooter where enemies are sound waves you tune your weapon to. I built it to study readability, telegraphing, and the tuning numbers behind game feel. It ships with a full design doc.",
    link: "/play/signal",
    kind: "Game, canvas and Web Audio",
    state: "live",
  },
  {
    name: "Interview Copilot",
    year: "2026",
    description:
      "A real-time copilot for meetings and interviews. It listens in, surfaces relevant context, and suggests responses on the fly, for calls where you can’t afford to fumble.",
    link: "https://interview-copilot.pplx.app",
    kind: "AI, real time",
    state: "live",
  },
];

const MORE: Project[] = [
  {
    name: "Automated Grocery Runner",
    year: "2026",
    description:
      "An agent that learns your preferences, writes the weekly grocery list, and schedules delivery. In development.",
    link: "",
    kind: "AI agents",
    state: "building",
  },
  {
    name: "Three Good Things",
    year: "2025",
    description:
      "A gratitude journal I built during a rough patch. Log three good moments a day, with a year-end recap planned.",
    link: "https://steep-frost-2548.21st.app/",
    kind: "React, AI",
    state: "live",
  },
  {
    name: "Did You Call Your Parents?",
    year: "2025",
    description: "A reminder app born from not calling home for two months. Gentle nudges to stay in touch with family.",
    link: "https://noisy-sky-5988.21st.app/",
    kind: "React",
    state: "live",
  },
  {
    name: "Rate My Resume",
    year: "2024",
    description: "A resume grader for internship applicants who want a quick sense check before they hit submit.",
    link: "https://resume-grader-0986b991.base44.app/",
    kind: "AI",
    state: "live",
  },
  {
    name: "OptimizeAI Dashboard",
    year: "2024",
    description:
      "An analytics dashboard for a pre-seed AI startup, showing model performance and user engagement.",
    link: "https://optimizeai.net/",
    kind: "Analytics",
    state: "live",
  },
  {
    name: "GPA Calculator",
    year: "2023",
    description: "Works out the exact final grade you need to hit a target GPA. Built for stressed undergrads.",
    link: "https://empty-smoke-6977.21st.app/",
    kind: "Utility",
    state: "live",
  },
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
    <PageWrapper>
      <PageIntro title="Things I’ve built">
        Side projects, made on nights and weekends. Most are small on purpose: the point is to learn what a product
        needs by shipping one.
      </PageIntro>

      <section className="wrap card-grid" aria-label="Featured projects">
        {FEATURED.map((project) => (
          <GlassLink key={project.name} href={project.link} className="tile">
            <h2 className="h3">{project.name}</h2>
            <p>{project.description}</p>
            <p className="meta">
              {project.kind}, {project.year}
            </p>
          </GlassLink>
        ))}
      </section>

      <section className="section wrap" aria-labelledby="more-title">
        <div className="section-head">
          <h2 id="more-title" className="h2 on-map">
            Smaller tools
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
    </PageWrapper>
  );
}
