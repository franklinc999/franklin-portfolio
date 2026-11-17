import type { Metadata } from "next";
import { Glass } from "@/components/Glass";
import { PageIntro, PageWrapper } from "@/components/Shared";
import { Zone } from "@/components/Zone";
import { ThreeGoodThings } from "@/components/tools/ThreeGoodThings";

export const metadata: Metadata = {
  title: "Three Good Things",
  description: "A gratitude journal by Franklin Cheng. Three good moments a day, kept in your own browser.",
};

export default function Page() {
  return (
    <PageWrapper ground="paper">
      <Zone theme="paper" as="div" className="zone-last">
        <PageIntro title="Three Good Things" titleClass="h-voice" back={{ href: "/projects", label: "All projects" }}>
          Write down three good things about today. It takes a minute. I built the first version during a rough patch.
        </PageIntro>
        <div className="wrap stack">
          <Glass kind="card" className="demo">
            <ThreeGoodThings />
          </Glass>
        </div>
      </Zone>
    </PageWrapper>
  );
}
