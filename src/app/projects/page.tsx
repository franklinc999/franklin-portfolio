import type { Metadata } from "next";
import { GameCards } from "@/components/GameCards";
import { Glass, GlassLink } from "@/components/Glass";
import { PageIntro, PageWrapper } from "@/components/Shared";
import { Zone } from "@/components/Zone";
import { TOOLS } from "@/lib/tools";
import { AgentLine } from "@/components/lab/AgentLine";
import { PenFactory } from "@/components/lab/PenFactory";
import { GlassPlayground } from "@/components/lab/GlassPlayground";
import { SlabAnatomy } from "@/components/lab/SlabAnatomy";

export const metadata: Metadata = {
  title: "Projects",
  description: "Things Franklin Cheng has built: four browser games, an always-on team of agents, and a few small tools you can use.",
};

const HERE = [
  { name: "The Pen Factory", where: "/#workshop", description: "A model of my always-on agent team: nine operators, a self-check, a fixer, and one switch that stands it all down." },
  { name: "Sensitivity converter", where: "/#arcade", description: "Carries your mouse sensitivity from one shooter to another by matching the distance of a full turn." },
  { name: "Gongfu timer", where: "/#off-the-clock", description: "Counts tea steeps in a glass cup that fills as the seconds run." },
];

export default function ProjectsPage() {
  return (
    <PageWrapper ground="blueprint">
      <Zone theme="blueprint" className="zone-last">
        <PageIntro title="Things I’ve built" titleClass="h1">
          Side projects, made on nights and weekends. Most are small on purpose: the point is to learn what a product
          needs by shipping one.
        </PageIntro>

        <div className="wrap stack">
          <section aria-label="Games">
            <GameCards as="h2" />
          </section>

          <section id="pen-factory" aria-labelledby="pen-title">
            <Glass kind="sheet" className="demo">
              <div className="demo-head">
                <p className="annot">fig. 1: a model of the real thing, with made-up work</p>
                <h2 id="pen-title" className="h3">
                  The Pen Factory
                </h2>
                <p>
                  An always-on team of agents that runs on my laptop: one process, nine operators, 26 scheduled jobs.
                  Always on, draft first, self-healing. The work on screen is invented.
                </p>
              </div>
              <PenFactory />
            </Glass>
          </section>

          <section aria-labelledby="line-title">
            <Glass kind="sheet" className="demo">
              <div className="demo-head">
                <p className="annot">fig. 2: a toy model, not a real system</p>
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
                <p className="annot">fig. 3: the glass on this site</p>
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
            <GlassPlayground />
          </section>

          <section aria-labelledby="more-title">
            <div className="section-head">
              <h2 id="more-title" className="h2 on-map">
                Tools you can use
              </h2>
            </div>
            <div className="card-grid">
              {TOOLS.map((tool) => (
                <GlassLink key={tool.slug} href={`/tools/${tool.slug}`} className="tile">
                  <h3 className="h3">{tool.name}</h3>
                  <p>{tool.blurb}</p>
                  <p className="meta">{tool.note}</p>
                </GlassLink>
              ))}
            </div>
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
