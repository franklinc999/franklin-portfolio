"use client";

import { PageWrapper, Contact } from "@/components/Shared";

export default function ContactPage() {
  return (
    <PageWrapper>
      <div className="h-20" />
      <div className="min-h-[70vh] flex items-center">
        <Contact />
      </div>
    </PageWrapper>
  );
}
