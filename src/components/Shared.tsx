"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function LinkedinIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function GithubIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Work", href: "/work" },
  { label: "Projects", href: "/projects" },
  { label: "Contact", href: "/contact" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 nav-glass rounded-full px-8 py-3 flex items-center gap-8 transition-all duration-300 ${
        scrolled ? "shadow-lg shadow-black/30" : ""
      }`}
    >
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`text-sm font-medium transition-colors duration-200 ${
            pathname === item.href
              ? "text-[var(--color-accent)]"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function Marquee() {
  const items = "Strategy · Product · AI · Go-to-Market · Due Diligence · Competitive Intel · Pricing · Operations · ";
  return (
    <div className="py-6 border-y border-[var(--color-border)] overflow-hidden">
      <div className="marquee-track">
        {[0, 1].map((i) => (
          <span
            key={i}
            className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-text-faint)] whitespace-nowrap px-4"
          >
            {items}{items}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Contact() {
  return (
    <section id="contact" className="py-24 px-6 dot-grid">
      <div className="max-w-3xl mx-auto text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-2 scroll-reveal">
          Contact
        </p>
        <h2 className="font-serif text-3xl lg:text-5xl text-white mb-4 scroll-reveal">
          Let&apos;s talk <span className="italic text-[var(--color-accent)]">next steps</span>
        </h2>
        <p className="text-[var(--color-text-muted)] mb-10 max-w-md mx-auto scroll-reveal">
          Open to strategy, product management, and consulting roles.
          Currently based in Los Angeles.
        </p>

        <div className="flex items-center justify-center gap-4 scroll-reveal">
          <a
            href="mailto:franklinc999@gmail.com"
            className="liquid-glass liquid-glass-border rounded-full px-8 py-3 flex items-center gap-2 text-sm font-medium text-white hover:border-[var(--color-border-glow)] transition-all duration-300 group"
          >
            <Mail size={16} className="group-hover:text-[var(--color-accent)] transition-colors" />
            <span>Email Me</span>
          </a>
          <a
            href="https://www.linkedin.com/in/franklinch/"
            target="_blank"
            rel="noopener noreferrer"
            className="liquid-glass liquid-glass-border rounded-full p-3 hover:border-[var(--color-border-glow)] transition-all duration-300 group"
          >
            <LinkedinIcon size={18} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
          </a>
          <a
            href="https://github.com/franklinc999"
            target="_blank"
            rel="noopener noreferrer"
            className="liquid-glass liquid-glass-border rounded-full p-3 hover:border-[var(--color-border-glow)] transition-all duration-300 group"
          >
            <GithubIcon size={18} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
          </a>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="py-8 px-6 border-t border-[var(--color-border)]">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <span className="font-mono text-xs text-[var(--color-text-faint)]">
          &copy; {new Date().getFullYear()} Franklin Cheng
        </span>
        <span className="font-mono text-xs text-[var(--color-text-faint)]">
          Built with intention
        </span>
      </div>
    </footer>
  );
}

export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <Nav />
      {children}
      <Footer />
    </main>
  );
}
