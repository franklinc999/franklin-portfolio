
import { useEffect, useState } from "react";
import s from "../gift.module.css";
import { Reveal, dateStamp, useAssetExists, useInView } from "./film";

/* ---------- live counter ---------- */
export function Counter({ since, her, stats }: { since: Date; her: string; stats: { value: string; label: string }[] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const iv = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, []);
  const ms = now ? Math.max(0, now - since.getTime()) : 0;
  const cells = [
    [Math.floor(ms / 864e5), "days"],
    [Math.floor(ms / 36e5) % 24, "hours"],
    [Math.floor(ms / 6e4) % 60, "minutes"],
    [Math.floor(ms / 1e3) % 60, "seconds"],
  ] as const;
  return (
    <section className={s.section}>
      <Reveal>
        <div className={s.kicker} style={{ textAlign: "center" }}>
          {her.toLowerCase()}, we have been us for
        </div>
      </Reveal>
      <div className={s.counterGrid}>
        {cells.map(([v, l]) => (
          <div key={l} className={s.counterCell}>
            <div className={s.counterVal}>{now ? String(v).padStart(2, "0") : "--"}</div>
            <div className={s.counterLbl}>{l}</div>
          </div>
        ))}
      </div>
      <div className={s.statsRow}>
        {stats.map((st, i) => (
          <Reveal key={st.label} delay={i * 150}>
            <div className={s.stat}>
              <div className={s.statVal}>{st.value}</div>
              <div className={s.statLbl}>{st.label}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------- the film ---------- */
export function Film({ src, poster, title, subtitle }: { src: string; poster: string; title: string; subtitle: string }) {
  const ok = useAssetExists(src);
  const posterOk = useAssetExists(poster);
  return (
    <section className={`${s.section} ${s.sectionGreen}`}>
      <Reveal>
        <div className={s.kicker} style={{ textAlign: "center" }}>
          reel one
        </div>
        <h2 className={s.sectionTitle}>{title}</h2>
      </Reveal>
      <Reveal delay={200}>
        <div className={s.tv}>
          {ok ? (
            <video src={src} poster={posterOk ? poster : undefined} controls playsInline preload="metadata" />
          ) : (
            <div className={s.developing}>
              <div className={s.redLight} />
              <div>STILL DEVELOPING</div>
              <div style={{ opacity: 0.5, fontSize: 14 }}>drop film.mp4 into /public/media/</div>
            </div>
          )}
        </div>
      </Reveal>
      <Reveal delay={400}>
        <p className={s.sub} style={{ marginTop: 28 }}>
          {subtitle}
        </p>
      </Reveal>
    </section>
  );
}

/* ---------- the letter ---------- */
export function Letter({
  greeting,
  paragraphs,
  signoff,
  signature,
}: {
  greeting: string;
  paragraphs: string[];
  signoff: string;
  signature: string;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!open) return;
    const total = paragraphs.length + 3;
    const iv = setInterval(() => setShown((n) => (n >= total ? n : n + 1)), 1100);
    return () => clearInterval(iv);
  }, [open, paragraphs.length]);
  const para = (i: number) => `${s.para} ${shown > i ? s.paraOn : ""}`;
  return (
    <section className={s.section}>
      <Reveal>
        <div className={s.kicker} style={{ textAlign: "center" }}>
          a letter
        </div>
        <h2 className={s.sectionTitle}>{open ? "read slowly" : "for your eyes only"}</h2>
      </Reveal>
      {!open ? (
        <Reveal delay={200}>
          <div
            className={s.envelope}
            onClick={() => setOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setOpen(true)}
          >
            <div className={s.envBack} />
            <div className={s.envFlap} />
            <div className={s.envFront} />
            <div className={s.seal}>F</div>
          </div>
          <p className={s.muted} style={{ textAlign: "center", marginTop: 20 }}>
            tap to break the seal
          </p>
        </Reveal>
      ) : (
        <div className={s.paper}>
          <p className={para(0)}>{greeting}</p>
          {paragraphs.map((p, i) => (
            <p key={i} className={para(i + 1)}>
              {p}
            </p>
          ))}
          <p className={para(paragraphs.length + 1)}>{signoff}</p>
          <p className={para(paragraphs.length + 2)} style={{ fontSize: "1.6em" }}>
            {signature}
          </p>
        </div>
      )}
    </section>
  );
}

/* ---------- film strip of moments ---------- */
type Moment = { date: string; title: string; caption: string; src: string };
function Frame({ m, i }: { m: Moment; i: number }) {
  const ok = useAssetExists(m.src);
  const hue = [350, 20, 160, 35, 340, 140][i % 6];
  return (
    <div className={s.frame}>
      <div
        className={s.framePic}
        style={
          ok
            ? { backgroundImage: `url(${m.src})` }
            : { background: `radial-gradient(circle at 40% 35%, hsl(${hue} 45% 30%), hsl(${hue} 50% 8%))` }
        }
      >
        <span>{dateStamp(new Date(m.date + "T12:00"))}</span>
      </div>
      <div className={s.frameTitle}>{m.title}</div>
      <div className={s.frameCap}>{m.caption}</div>
    </div>
  );
}
export function Moments({ moments }: { moments: Moment[] }) {
  return (
    <section className={s.section} style={{ paddingLeft: 0, paddingRight: 0 }}>
      <Reveal>
        <div className={s.kicker} style={{ textAlign: "center" }}>
          contact sheet
        </div>
        <h2 className={s.sectionTitle}>frames I kept</h2>
      </Reveal>
      <div className={s.strip}>
        <div className={s.stripInner}>
          {moments.map((m, i) => (
            <Frame key={i} m={m} i={i} />
          ))}
        </div>
      </div>
      <p className={s.muted} style={{ marginTop: 24 }}>
        swipe
      </p>
    </section>
  );
}

/* ---------- reasons deck ---------- */
export function Reasons({ reasons }: { reasons: string[] }) {
  const [top, setTop] = useState(0);
  return (
    <section className={`${s.section} ${s.sectionGreen}`}>
      <Reveal>
        <div className={s.kicker} style={{ textAlign: "center" }}>
          {reasons.length} of infinitely many
        </div>
        <h2 className={s.sectionTitle}>reasons</h2>
      </Reveal>
      <div className={s.deck} onClick={() => setTop((t) => (t + 1) % reasons.length)}>
        {reasons.map((r, i) => {
          const pos = (i - top + reasons.length) % reasons.length;
          const gone = pos === reasons.length - 1 && reasons.length > 2;
          return (
            <div
              key={i}
              className={s.card}
              style={{
                zIndex: reasons.length - pos,
                transform: gone
                  ? "translate(-120%, -10%) rotate(-18deg)"
                  : `translateY(${pos * 6}px) rotate(${(pos % 2 ? 1 : -1) * pos * 1.2}deg)`,
                opacity: gone ? 0 : pos > 4 ? 0 : 1,
              }}
            >
              <span className={s.cardNum}>no. {String(i + 1).padStart(2, "0")}</span>
              {r}
            </div>
          );
        })}
      </div>
      <p className={s.muted} style={{ marginTop: 24 }}>
        tap for the next one
      </p>
    </section>
  );
}

/* ---------- open when... ---------- */
export function OpenWhen({ items, unlockYear3 }: { items: { label: string; body: string }[]; unlockYear3: Date }) {
  const [open, setOpen] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(id);
  }, []);
  return (
    <section className={s.section}>
      <Reveal>
        <div className={s.kicker} style={{ textAlign: "center" }}>
          for later
        </div>
        <h2 className={s.sectionTitle}>open when...</h2>
      </Reveal>
      <div className={s.owGrid}>
        {items.map((it, i) => {
          const isFuture = /3rd anniversary|third anniversary/i.test(it.label);
          const locked = isFuture && (now === null || now < unlockYear3.getTime());
          return (
            <button
              key={i}
              className={`${s.ow} ${locked ? s.locked : ""}`}
              onClick={() => !locked && setOpen(open === i ? null : i)}
            >
              <small>open when</small>
              {it.label}
              {open === i && <div className={s.owBody}>{it.body}</div>}
              {locked && <div className={s.owBody}>sealed until {unlockYear3.toLocaleDateString()}</div>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- finale ---------- */
export function Finale({ text, me }: { text: string; me: string }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.5);
  const [petals, setPetals] = useState<{ id: number; left: number; dur: number; dx: number; rot: number; c: string }[]>([]);
  useEffect(() => {
    if (!inView) return;
    const colors = ["#b3122e", "#f2b6c1", "#f7d9a8", "#e86a7d"];
    let id = 0;
    const iv = setInterval(() => {
      setPetals((p) =>
        [
          ...p,
          {
            id: id++,
            left: Math.random() * 100,
            dur: 6 + Math.random() * 6,
            dx: (Math.random() - 0.5) * 300,
            rot: Math.random() * 720,
            c: colors[(Math.random() * colors.length) | 0],
          },
        ].slice(-60),
      );
    }, 220);
    return () => clearInterval(iv);
  }, [inView]);
  return (
    <section className={s.section} style={{ minHeight: "90vh" }}>
      <div ref={ref}>
        <Reveal>
          <h2 className={s.title} style={{ textAlign: "center", maxWidth: 900 }}>
            {text}
          </h2>
        </Reveal>
        <Reveal delay={600}>
          <p className={s.sub} style={{ margin: "40px auto 0" }}>
            happy anniversary. love, {me}
          </p>
        </Reveal>
        <Reveal delay={1000}>
          <div style={{ textAlign: "center" }}>
            <button className={`${s.btn} ${s.ghostBtn}`} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              rewind
            </button>
          </div>
        </Reveal>
      </div>
      {petals.map((p) => (
        <i
          key={p.id}
          className={s.petal}
          style={
            {
              left: `${p.left}vw`,
              background: p.c,
              animationDuration: `${p.dur}s`,
              "--dx": `${p.dx}px`,
              "--rot": `${p.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </section>
  );
}
