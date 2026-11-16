import Link from "next/link";
import { Badge } from "@/components/Badge";
import { FieldHeading } from "@/components/FieldHeading";
import { Glass, GlassLink } from "@/components/Glass";
import { HeroName } from "@/components/HeroName";
import { Marquee } from "@/components/Marquee";
import { Rotator } from "@/components/Rotator";
import { Contact, PageWrapper } from "@/components/Shared";
import { SHOTS } from "@/lib/shots";
import { Zone } from "@/components/Zone";
import { AgentLine } from "@/components/lab/AgentLine";
import { SensConverter } from "@/components/lab/SensConverter";
import { TeaTimer } from "@/components/lab/TeaTimer";

const ROLES = ["a product manager", "a builder of agents", "a maker of small games", "a Valorant and League regular", "a tea person"];

const MARQUEE = ["Product", "Agents", "Shooters", "MOBAs", "Tea", "Pickleball", "Points", "Cooking", "Los Angeles"];

const LOVES = ["Valorant", "League of Legends", "Call of Duty", "Cooking", "Tea", "Pickleball", "Credit card points"];

export default function Home() {
  return (
    <PageWrapper ground="sunset">
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

        <Marquee words={MARQUEE} />

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
            <p className="annot on-map">fig. 1: a toy model, not a real system</p>
            <FieldHeading className="h-zone">From the workshop</FieldHeading>
            <p className="lede on-map">
              I build agents for work that repeats. The agent is the easy part. What decides whether you can trust
              the output is everything around it: the check, the retry, the watchdog.
            </p>
          </div>

          <Glass kind="sheet" className="demo">
            <div className="demo-head">
              <h3 className="h3">Try to break this pipeline</h3>
              <p>
                Tasks ride the line from intake to ship. Send a bad one, switch the checker off, or stall the writer,
                and watch what the line does about it.
              </p>
            </div>
            <AgentLine />
          </Glass>

          <div>
            <div className="section-head">
              <h3 className="h2 on-map">Also on the bench</h3>
              <Link className="text-link on-map" href="/projects">
                All projects
              </Link>
            </div>
            <div className="card-grid">
              <GlassLink href="https://interview-copilot.pplx.app" className="tile">
                <h4 className="h3">Interview Copilot</h4>
                <p>
                  A real-time copilot for interviews and meetings. It listens in, surfaces context, and suggests what
                  to say next.
                </p>
                <p className="meta">Opens in a new tab</p>
              </GlassLink>
              <Glass as="article" kind="card" className="tile">
                <h4 className="h3">Automated Grocery Runner</h4>
                <p>
                  An agent that learns what I buy, writes the weekly list, and schedules the delivery. Still on the
                  bench.
                </p>
                <p className="meta">In progress</p>
              </Glass>
              <GlassLink href="/projects#glass" className="tile">
                <h4 className="h3">The glass you&rsquo;re looking through</h4>
                <p>
                  Every slab on this site is drawn by one shader that bends the page behind it. There&rsquo;s a spec
                  drawing of how.
                </p>
                <p className="meta">See the drawing</p>
              </GlassLink>
            </div>
          </div>
        </div>
      </Zone>

      <Zone theme="arcade" id="arcade">
        <div className="wrap stack">
          <div className="zone-intro">
            <FieldHeading className="h-pixel">Press start</FieldHeading>
            <p className="lede on-map">
              Two games I made, playable right here. One is a shooter built around a single mechanic. The other is the
              warmup I use before I queue.
            </p>
          </div>

          <div className="card-grid two">
            <GlassLink href="/play/signal" className="shot">
              <span className="shot-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/shots/signal.jpg" alt={SHOTS.signal} width={1200} height={750} loading="lazy" />
              </span>
              <div className="shot-body">
                <h3 className="h3">Signal // Noise</h3>
                <p>
                  A twin-stick shooter where enemies are sound waves and you tune your weapon to their band. It ships
                  with its design doc.
                </p>
                <p className="meta">Keyboard and mouse</p>
              </div>
            </GlassLink>
            <GlassLink href="/play/warmup" className="shot">
              <span className="shot-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/shots/warmup.jpg" alt={SHOTS.warmup} width={1200} height={750} loading="lazy" />
              </span>
              <div className="shot-body">
                <h3 className="h3">Range Warmup</h3>
                <p>
                  An aim trainer that matches your real sensitivity in Valorant, Call of Duty, or Apex, so the muscle
                  memory carries over.
                </p>
                <p className="meta">Mouse required</p>
              </div>
            </GlassLink>
          </div>

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
