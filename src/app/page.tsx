import Link from "next/link";
import { Badge } from "@/components/Badge";
import { FieldHeading } from "@/components/FieldHeading";
import { Glass, GlassLink } from "@/components/Glass";
import { HeroName } from "@/components/HeroName";
import { Rotator } from "@/components/Rotator";
import { GameCards } from "@/components/GameCards";
import { TOOLS } from "@/lib/tools";
import { Contact, PageWrapper } from "@/components/Shared";
import { Stickers } from "@/components/Stickers";
import { Trail } from "@/components/Trail";
import { Zone } from "@/components/Zone";
import { PenFactory } from "@/components/lab/PenFactory";
import { SensConverter } from "@/components/lab/SensConverter";
import { TeaTimer } from "@/components/lab/TeaTimer";

const ROLES = ["a product manager", "a builder of agents", "a maker of small games", "a Valorant and League regular", "a tea person"];

const LOVES = ["Valorant", "League of Legends", "Call of Duty", "Cooking", "Tea", "Pickleball", "Credit card points"];

export default function Home() {
  return (
    <PageWrapper ground="sunset">
      <Trail />
      <Zone theme="abyss">
        <section className="hero">
          <Badge />
          <div className="hero-copy wrap">
            <HeroName lines={["Franklin", "Cheng"]} />
            <p className="lede on-map">
              <span className="rotator-line">
                I&rsquo;m <Rotator items={ROLES} />
              </span>
              By day I work on Call of Duty at Activision. The rest of the time I build AI agents, make small games,
              and brew a lot of tea.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-solid" href="/projects">
                See what I build
              </Link>
              <Link className="btn btn-glass" href="/play">
                Play a game I made
              </Link>
            </div>
          </div>
        </section>

        <Stickers />

        <section className="wrap" aria-labelledby="sides-title">
          <div className="zone-intro">
            <FieldHeading id="sides-title" className="h-zone">
              By day, by night, in between
            </FieldHeading>
          </div>
          <div className="card-grid facets">
            <GlassLink href="/work" className="tile">
              <p className="note">by day</p>
              <h3 className="h3">Product</h3>
              <p>
                I&rsquo;m a product manager on Call of Duty&rsquo;s live service. I like the unglamorous parts of the
                job: schedules people can trust, and numbers that mean what they say.
              </p>
              <p className="meta">How I work</p>
            </GlassLink>
            <GlassLink href="/projects" className="tile">
              <p className="note">by night</p>
              <h3 className="h3">Build</h3>
              <p>
                When a task repeats, I build an agent for it. Then I build the thing that tells me when the agent is
                wrong, which is the part that matters.
              </p>
              <p className="meta">Things I&rsquo;ve built</p>
            </GlassLink>
            <GlassLink href="/play" className="tile">
              <p className="note">in between</p>
              <h3 className="h3">Play</h3>
              <p>
                Shooters and MOBAs, mostly. I also make small games of my own, because building one is the fastest way
                to learn why a good one feels good.
              </p>
              <p className="meta">Games you can play here</p>
            </GlassLink>
          </div>
        </section>
      </Zone>

      <Zone theme="blueprint" id="workshop">
        <div className="wrap stack">
          <div className="zone-intro">
            <p className="annot on-map">fig. 1: a model of the real thing, with made-up work</p>
            <FieldHeading className="h-zone">From the workshop</FieldHeading>
            <p className="lede on-map">
              I build agents for work that repeats. The agent is the easy part. What decides whether you can trust
              the output is everything around it: the check, the retry, the watchdog.
            </p>
          </div>

          <Glass kind="sheet" className="demo">
            <div className="demo-head">
              <h3 className="h3">The Pen Factory</h3>
              <p>
                An always-on team of agents that runs on my laptop: one process, nine operators, 26 scheduled jobs.
                Each operator has a job and an autonomy level. This is a model of it, and the work on screen is
                invented.
              </p>
            </div>
            <PenFactory />
            <ul className="pen-rules">
              <li>Every finished report lands in Deliverables, self-checked.</li>
              <li>Exit 0 is not success: the fixer watches outcomes.</li>
              <li>One click stands everything down. Nothing posts without my approval.</li>
            </ul>
          </Glass>

          <div>
            <div className="section-head">
              <h3 className="h2 on-map">Also on the bench</h3>
              <Link className="text-link on-map" href="/projects">
                All projects
              </Link>
            </div>
            <div className="card-grid">
              {TOOLS.map((tool) => (
                <GlassLink key={tool.slug} href={`/tools/${tool.slug}`} className="tile">
                  <h4 className="h3">{tool.name}</h4>
                  <p>{tool.blurb}</p>
                  <p className="meta">{tool.note}</p>
                </GlassLink>
              ))}
            </div>
          </div>
        </div>
      </Zone>

      <Zone theme="arcade" id="arcade">
        <div className="wrap stack">
          <div className="zone-intro">
            <FieldHeading className="h-pixel">Press start</FieldHeading>
            <p className="lede on-map">
              Games I made, playable right here. I build them to learn why the good ones feel good, and because it
              is the most fun way to test an idea.
            </p>
          </div>

          <GameCards lazy />

          <Glass kind="card" className="demo">
            <div className="demo-head">
              <h3 className="h3">Carry your aim between games</h3>
              <p>
                Every shooter counts mouse movement differently. Enter your settings for one, and get the sensitivity
                that feels the same in the others.
              </p>
            </div>
            <SensConverter />
          </Glass>
        </div>
      </Zone>

      <Zone theme="paper" id="off-the-clock">
        <div className="wrap stack">
          <div className="zone-intro">
            <FieldHeading className="h-voice">Off the clock</FieldHeading>
          </div>

          <div className="about">
            <Glass kind="sheet" className="prose voice">
              <p className="voice">
                I grew up in the San Gabriel Valley and studied Philosophy, Politics and Economics at Penn, with minors
                in Consumer Psychology and East Asian Area Studies. That mix is why I look at a product from two sides:
                how people behave, and how the market around them is built.
              </p>
              <p className="voice">
                I started in strategy consulting, kept building tools on the side, and moved into games in 2026 to
                work on one I actually play. I speak English and Mandarin.
              </p>
              <div className="loves">
                {LOVES.map((item) => (
                  <span key={item} className="chip">
                    {item}
                  </span>
                ))}
                <span className="note">ask me about any of these</span>
              </div>
            </Glass>
            <Glass kind="card" className="portrait">
              <span className="portrait-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/portrait.jpg" alt="Franklin in sunglasses and a leather jacket on a path above the sea" width={880} height={1100} loading="lazy" />
              </span>
              <p className="note">that&rsquo;s me, by the sea</p>
            </Glass>
          </div>

          <Glass kind="card" className="demo">
            <div className="demo-head">
              <h3 className="h3">A gongfu timer</h3>
              <p>
                I make a lot of tea. This counts the steeps so I don&rsquo;t have to. The times are starting points:
                the leaf decides the rest.
              </p>
            </div>
            <TeaTimer />
          </Glass>
        </div>
      </Zone>

      <Zone theme="sunset" className="zone-last">
        <div className="wrap">
          <Contact />
        </div>
      </Zone>
    </PageWrapper>
  );
}
