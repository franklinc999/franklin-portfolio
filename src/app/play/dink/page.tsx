"use client";

import dynamic from "next/dynamic";
import { Glass } from "@/components/Glass";
import { PageIntro, PageWrapper } from "@/components/Shared";
import { Zone } from "@/components/Zone";

// The court needs WebGL, so it loads in the browser only.
const PickleGame = dynamic(() => import("@/components/play/pickle/PickleGame"), {
  ssr: false,
  loading: () => <div className="game-loading">Rolling out the net</div>,
});

export default function DinkPage() {
  return (
    <PageWrapper ground="arcade">
      <Zone theme="arcade" as="div" className="zone-last">
        <PageIntro title="Dink" titleClass="h-pixel" back={{ href: "/play", label: "All games" }}>
          Singles pickleball in a Sunday rec league, on a real-size court. You are a pickle. Pick your spot, time the
          swing, and move the other vegetable around until there is a gap.
        </PageIntro>
        <div className="wrap stack">
          <PickleGame />
          <Glass kind="card" className="demo game-notes">
            <h2 className="h3">How it works</h2>
            <ul>
              <li>
                Click or tap the far side where you want the ball to land. Swing as the dark ring closes on the
                pale one. A short target is a dink, a deep one is a drive.
              </li>
              <li>On a keyboard, the arrow keys move your aim and Space swings. Esc pauses.</li>
              <li>
                The court is to scale, with the kitchen in yellow. The rules are trimmed: every ball bounces once, a
                serve has to clear the kitchen, you get one serve, and whoever wins the point serves next. Win by two.
              </li>
            </ul>
          </Glass>
        </div>
      </Zone>
    </PageWrapper>
  );
}
