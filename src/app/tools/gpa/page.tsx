import type { Metadata } from "next";
import { Glass } from "@/components/Glass";
import { PageIntro, PageWrapper } from "@/components/Shared";
import { Zone } from "@/components/Zone";
import { GpaCalc } from "@/components/tools/GpaCalc";

export const metadata: Metadata = {
  title: "GPA Calculator",
  description: "Work out the term GPA or the final exam grade you need to hit a target.",
};

export default function Page() {
  return (
    <PageWrapper ground="paper">
      <Zone theme="paper" as="div" className="zone-last">
        <PageIntro title="GPA Calculator" titleClass="h-voice" back={{ href: "/projects", label: "All projects" }}>
          The question every student asks in week twelve: what do I need to get? Put in where you stand and where you want to end up.
        </PageIntro>
        <div className="wrap stack">
          <Glass kind="card" className="demo">
            <GpaCalc />
          </Glass>
        </div>
      </Zone>
    </PageWrapper>
  );
}
