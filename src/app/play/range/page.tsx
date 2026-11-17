"use client";

import dynamic from "next/dynamic";
import { Glass } from "@/components/Glass";
import { PageIntro, PageWrapper } from "@/components/Shared";
import { Zone } from "@/components/Zone";

// The range needs WebGL and the mouse, so it loads in the browser only.
const RangeGame = dynamic(() => import("@/components/play/range/RangeGame"), {
  ssr: false,
  loading: () => <div className="game-loading">Setting up the range</div>,
});

export default function RangePage() {
  return (
    <PageWrapper ground="arcade">
      <Zone theme="arcade" as="div" className="zone-last">
        <PageIntro title="The Range" titleClass="h-pixel" back={{ href: "/play", label: "All games" }}>
          Four stages on a desert range, breaking clays. Set the game you play and your sensitivity, and a full turn
          here takes the same sweep of the mouse as it does there.
        </PageIntro>
        <div className="wrap stack">
          <RangeGame />
          <Glass kind="card" className="demo game-notes">
            <h2 className="h3">How it works</h2>
            <ul>
              <li>Click Start and the range takes the mouse. Esc gives it back and pauses the round.</li>
              <li>
                Each game turns the view by a fixed angle per mouse count. The range uses the same angle, and asks
                the browser for raw mouse input so the system’s pointer acceleration stays out of it.
              </li>
              <li>On a phone or a trackpad you can still play: tap or click a clay and the shot goes there.</li>
              <li>
                When a stage ends, every hit is plotted on one paper target, so you can see whether your group sits
                high, low, left or right.
              </li>
            </ul>
          </Glass>
        </div>
      </Zone>
    </PageWrapper>
  );
}
