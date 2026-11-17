import type { Metadata } from "next";
import { Glass } from "@/components/Glass";
import { PageIntro, PageWrapper } from "@/components/Shared";
import { Zone } from "@/components/Zone";
import { CallHome } from "@/components/tools/CallHome";

export const metadata: Metadata = {
  title: "Did You Call Your Parents?",
  description: "A small tool by Franklin Cheng that counts the days since you last called home.",
};

export default function Page() {
  return (
    <PageWrapper ground="paper">
      <Zone theme="paper" as="div" className="zone-last">
        <PageIntro title="Did You Call Your Parents?" titleClass="h-voice" back={{ href: "/projects", label: "All projects" }}>
          I once went two months without calling home. This counts the days so you do not have to, and says so when it has been too long.
        </PageIntro>
        <div className="wrap stack">
          <Glass kind="card" className="demo">
            <CallHome />
          </Glass>
        </div>
      </Zone>
    </PageWrapper>
  );
}
