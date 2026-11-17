import type { Metadata } from "next";
import { Glass } from "@/components/Glass";
import { PageIntro, PageWrapper } from "@/components/Shared";
import { Zone } from "@/components/Zone";
import { PtoPlanner } from "@/components/tools/PtoPlanner";

export const metadata: Metadata = {
  title: "PTO Planner",
  description: "Tell it how many days of PTO you have and which holidays your company gives. It finds the days to take for the most time off.",
};

export default function Page() {
  return (
    <PageWrapper ground="paper">
      <Zone theme="paper" as="div" className="zone-last">
        <PageIntro title="PTO Planner" titleClass="h-voice" back={{ href: "/projects", label: "All projects" }}>
          The same fifteen days can be fifteen days off or forty, depending on which ones you take. This finds the
          ones to take.
        </PageIntro>
        <div className="wrap stack">
          <Glass kind="card" className="demo">
            <PtoPlanner />
          </Glass>
        </div>
      </Zone>
    </PageWrapper>
  );
}
