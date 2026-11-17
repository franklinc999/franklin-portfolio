import { Glass } from "@/components/Glass";
import { PageIntro, PageWrapper } from "@/components/Shared";
import { Zone } from "@/components/Zone";
import OpsGame from "@/components/play/ops/OpsGame";

export default function OpsPage() {
  return (
    <PageWrapper ground="arcade">
      <Zone theme="arcade" as="div" className="zone-last">
        <PageIntro title="Live Ops" titleClass="h-pixel" back={{ href: "/play", label: "All games" }}>
          Run eight weeks of a live game. Decide what ships, keep players happy, make money, and try to have a team
          left at the end.
        </PageIntro>
        <div className="wrap stack">
          <OpsGame />
          <Glass kind="card" className="demo game-notes">
            <h2 className="h3">What it is about</h2>
            <ul>
              <li>Everything in it is made up: the game, the cards, the events and every number.</li>
              <li>
                The four meters pull against each other on purpose. New content brings players and wears down the
                game and the team. Selling makes money and spends goodwill. Upkeep is the week nobody thanks you for.
              </li>
              <li>
                Grades come from simulating a few hundred seasons. Picking at random lands around a C, and planning a
                week ahead gets you an A.
              </li>
            </ul>
          </Glass>
        </div>
      </Zone>
    </PageWrapper>
  );
}
