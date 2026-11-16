import type { Metadata } from "next";
import { FieldHeading } from "@/components/FieldHeading";
import { Glass } from "@/components/Glass";
import { LINKEDIN, EMAIL, PageIntro, PageWrapper } from "@/components/Shared";
import { Zone } from "@/components/Zone";

export const metadata: Metadata = {
  title: "Work",
  description: "How Franklin Cheng works: product on Call of Duty at Activision, strategy consulting before that, and what carries across both.",
};

const HABITS = [
  {
    note: "first",
    title: "Find out what’s true",
    body: "Before a plan, the facts: what the data says, what people are actually doing, and where the two disagree. Consulting taught me to start there.",
  },
  {
    note: "then",
    title: "Make the source boring",
    body: "A schedule or a dashboard is only useful once people stop double-checking it. A lot of product work is getting something to that point and keeping it there.",
  },
  {
    note: "always",
    title: "Automate the repeat work",
    body: "If I do the same pull twice, I build something to do it for me, and something else to tell me when it breaks.",
  },
];

const PATH = [
  { org: "Activision", role: "Associate Product Manager, Call of Duty", when: "2026 to now" },
  { org: "Sia (formerly Kaiser Associates)", role: "Associate Consultant", when: "2024 to 2026" },
  { org: "RSM", role: "AI Consulting Intern", when: "2024" },
  { org: "OptimizeAI", role: "Product Lead, pre-seed", when: "2024" },
  { org: "Meta News", role: "Product and Strategy", when: "2022 to 2024" },
  { org: "Museum of Future Experiences (YC)", role: "Growth and Product", when: "2023" },
];

export default function WorkPage() {
  return (
    <PageWrapper ground="paper">
      <Zone theme="abyss">
        <PageIntro title="Work, briefly">
          I&rsquo;m a product manager on Call of Duty&rsquo;s live service at Activision. Before that I was a strategy
          consultant. The job titles changed; the way I work mostly didn&rsquo;t.
        </PageIntro>

        <section className="wrap card-grid facets" aria-label="How I work">
          {HABITS.map((habit) => (
            <Glass key={habit.title} as="article" kind="card" className="tile">
              <p className="note">{habit.note}</p>
              <h2 className="h3">{habit.title}</h2>
              <p>{habit.body}</p>
            </Glass>
          ))}
        </section>
      </Zone>

      <Zone theme="paper" className="zone-last">
        <div className="wrap stack">
          <div className="zone-intro">
            <FieldHeading className="h-voice">The path so far</FieldHeading>
          </div>
          <div className="about">
            <Glass kind="sheet" className="prose">
              <ol className="timeline">
                {PATH.map((item) => (
                  <li key={item.org}>
                    <span className="org">{item.org}</span>
                    <span className="when">{item.when}</span>
                    <span className="role">{item.role}</span>
                  </li>
                ))}
              </ol>
            </Glass>
            <Glass kind="card" className="prose voice">
              <p className="voice">
                The specifics live on my r&eacute;sum&eacute;. This page is the short version on purpose.
              </p>
              <div className="contact-links">
                <a className="btn btn-solid" href={LINKEDIN} target="_blank" rel="noopener noreferrer">
                  LinkedIn
                </a>
                <a className="btn btn-glass" href={`mailto:${EMAIL}?subject=R%C3%A9sum%C3%A9`}>
                  Ask for the r&eacute;sum&eacute;
                </a>
              </div>
            </Glass>
          </div>
        </div>
      </Zone>
    </PageWrapper>
  );
}
