"use client";

import dynamic from "next/dynamic";
import { Glass } from "@/components/Glass";
import { PageIntro, PageWrapper } from "@/components/Shared";
import { Zone } from "@/components/Zone";

// The arena needs WebGL, so it loads in the browser only.
const BossGame = dynamic(() => import("@/components/play/boss/BossGame"), {
  ssr: false,
  loading: () => <div className="game-stage game-loading">Stacking the blocks</div>,
});

export default function BacklogPage() {
  return (
    <PageWrapper ground="arcade">
      <Zone theme="arcade" as="div" className="zone-last">
        <PageIntro title="The Backlog" titleClass="h-pixel" back={{ href: "/play", label: "All games" }}>
          A boss fight. One arena, one tower of blocks that gets faster as you cut it down, and a sword.
        </PageIntro>
        <div className="wrap stack">
          <BossGame />
          <Glass kind="card" className="demo game-notes">
            <h2 className="h3">How it works</h2>
            <ul>
              <li>
                Nothing hits you without warning. A shape fills in on the floor, and the attack lands when it is full.
              </li>
              <li>
                Rolling makes you untouchable for a third of a second. That is how you get through the ring, which
                you cannot outrun.
              </li>
              <li>
                Hitting and rolling both cost stamina, so you cannot do either forever. The third swing in a row hits
                hardest.
              </li>
              <li>It changes at 60% and again at 28%. Each time it winds up faster and adds to what it already does.</li>
            </ul>
          </Glass>
        </div>
      </Zone>
    </PageWrapper>
  );
}
