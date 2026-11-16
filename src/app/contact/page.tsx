import type { Metadata } from "next";
import { Contact, PageWrapper } from "@/components/Shared";
import { Zone } from "@/components/Zone";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Franklin Cheng by email, LinkedIn, or GitHub.",
};

export default function ContactPage() {
  return (
    <PageWrapper ground="sunset">
      <Zone theme="sunset" className="zone-last">
        <div className="wrap contact-page">
          <Contact heading="h1" />
        </div>
      </Zone>
    </PageWrapper>
  );
}
