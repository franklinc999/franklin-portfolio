import type { Metadata } from "next";
import { Contact, PageWrapper } from "@/components/Shared";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Franklin Cheng by email, LinkedIn, or GitHub.",
};

export default function ContactPage() {
  return (
    <PageWrapper>
      <div className="wrap contact-page">
        <Contact heading="h1" />
      </div>
    </PageWrapper>
  );
}
