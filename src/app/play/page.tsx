import type { Metadata } from "next";
import { GameCards } from "@/components/GameCards";
import { Glass } from "@/components/Glass";
import { PageIntro, PageWrapper } from "@/components/Shared";
import { Zone } from "@/components/Zone";
import { SensConverter } from "@/components/lab/SensConverter";

export const metadata: Metadata = {
  title: "Play",
  description: "Browser games by Franklin Cheng, playable on the page.",
};

export default function PlayHub() {
  return (
    <PageWrapper ground="arcade">
      <Zone theme="arcade" className="zone-last">
        <PageIntro title="Press start" titleClass="h-pixel">
          Games I made, playable right here. I build them to learn why the good ones feel good.
        </PageIntro>

        <div className="wrap stack">
          <section aria-label="Games">
            <GameCards as="h2" />
          </section>

          <Glass kind="card" className="demo">
            <div className="demo-head">
              <h2 className="h3">Carry your aim between games</h2>
              <p>
                Every shooter counts mouse movement differently. Enter your settings for one, and get the sensitivity
                that feels the same in the others.
              </p>
            </div>
            <SensConverter />
          </Glass>
        </div>
      </Zone>
    </PageWrapper>
  );
}
