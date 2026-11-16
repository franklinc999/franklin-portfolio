import Link from "next/link";
import { Mail } from "lucide-react";
import { FieldHeading } from "@/components/FieldHeading";
import type { ThemeName } from "@/lib/field/shader";

export const EMAIL = "franklinc999@gmail.com";
export const LINKEDIN = "https://www.linkedin.com/in/franklinch/";
export const GITHUB = "https://github.com/franklinc999";

function LinkedinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function GithubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export function ContactLinks() {
  return (
    <div className="contact-links">
      <a className="btn btn-solid" href={`mailto:${EMAIL}`}>
        <Mail size={18} strokeWidth={1.6} aria-hidden="true" />
        Email me
      </a>
      <a className="btn btn-glass" href={LINKEDIN} target="_blank" rel="noopener noreferrer">
        <LinkedinIcon />
        LinkedIn
      </a>
      <a className="btn btn-glass" href={GITHUB} target="_blank" rel="noopener noreferrer">
        <GithubIcon />
        GitHub
      </a>
    </div>
  );
}

/** Closing invitation. It sits straight on the ground, no slab, so the page ends in the open. */
export function Contact({ heading = "h2" }: { heading?: "h1" | "h2" }) {
  return (
    <section className="contact" aria-labelledby="contact-title">
      <FieldHeading as={heading} id="contact-title" className="display">
        Say hello
      </FieldHeading>
      <p className="lede on-map">
        I like talking about live games, agents that do real work, and anything worth building. I&rsquo;m in Los
        Angeles.
      </p>
      <ContactLinks />
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer wrap">
      <span className="on-map">&copy; {new Date().getFullYear()} Franklin Cheng</span>
      <span className="on-map">Personal site. Opinions are mine, not my employer&rsquo;s.</span>
    </footer>
  );
}

/** `ground` names the zone the page ends in, so the footer takes that zone's ink. */
export function PageWrapper({ children, ground = "abyss" }: { children: React.ReactNode; ground?: ThemeName }) {
  return (
    <>
      <main id="main">{children}</main>
      <div data-zone={ground}>
        <Footer />
      </div>
    </>
  );
}

type IntroProps = {
  title: string;
  children?: React.ReactNode;
  back?: { href: string; label: string };
  /** Which face the title is set in. Defaults to the site's own. */
  titleClass?: string;
};

/** Heading block that opens every inner page. The title is drawn into the ground. */
export function PageIntro({ title, children, back, titleClass = "h1" }: IntroProps) {
  return (
    <header className="page-intro wrap">
      {back && (
        <Link className="back-link" href={back.href}>
          {back.label}
        </Link>
      )}
      <FieldHeading as="h1" className={titleClass}>
        {title}
      </FieldHeading>
      {children && <p className="lede">{children}</p>}
    </header>
  );
}
