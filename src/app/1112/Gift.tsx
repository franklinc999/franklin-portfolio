"use client";

import { useEffect, useRef, useState } from "react";
import { gift } from "./content";
import s from "./gift.module.css";
import { Bouquet } from "./components/Bouquet";
import { FilmOverlay, Reveal, dateStamp, useAssetExists } from "./components/film";
import { FogMirror } from "./components/FogMirror";
import { Counter, Film, Finale, Letter, Moments, OpenWhen, Reasons } from "./components/Sections";
import { StockGift } from "./components/StockGift";

type Stage = "loading" | "locked" | "gate" | "mirror" | "story";
const norm = (v: string) => v.toLowerCase().replace(/[\s/.\-]/g, "");

export default function Gift() {
  const [stage, setStage] = useState<Stage>("loading");
  const [now, setNow] = useState(0);
  const unlockAt = new Date(gift.unlockAt);
  const since = new Date(gift.startedAt);
  const year3 = new Date(since);
  year3.setFullYear(since.getFullYear() + 3);

  useEffect(() => {
    const preview = new URLSearchParams(window.location.search).has("preview");
    const t = Date.now();
    setNow(t);
    if (!preview && t < unlockAt.getTime()) setStage("locked");
    else setStage("gate");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // countdown tick while locked
  useEffect(() => {
    if (stage !== "locked") return;
    const iv = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= unlockAt.getTime()) setStage("gate");
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // music
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasSong = useAssetExists(gift.music.src);
  const [playing, setPlaying] = useState(false);
  const startMusic = () => {
    const a = audioRef.current;
    if (!a || !hasSong) return;
    a.volume = 0;
    a.play()
      .then(() => {
        setPlaying(true);
        let v = 0;
        const iv = setInterval(() => {
          v = Math.min(0.6, v + 0.03);
          a.volume = v;
          if (v >= 0.6) clearInterval(iv);
        }, 120);
      })
      .catch(() => {});
  };
  const toggleMusic = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().then(() => setPlaying(true));
    else {
      a.pause();
      setPlaying(false);
    }
  };

  const stamp = dateStamp(stage === "story" || stage === "mirror" ? new Date() : unlockAt);

  return (
    <div className={s.root}>
      <FilmOverlay stamp={stamp} />
      {hasSong && <audio ref={audioRef} src={gift.music.src} loop preload="auto" />}
      {hasSong && (stage === "story" || stage === "mirror") && (
        <button className={s.musicBtn} onClick={toggleMusic}>
          {playing ? "♪ " + gift.music.title : "♪ play"}
        </button>
      )}

      {stage === "locked" && <Locked now={now} unlockAt={unlockAt} her={gift.her} />}
      {stage === "gate" && (
        <Gate
          onPass={() => {
            startMusic();
            setStage("mirror");
          }}
        />
      )}
      {stage === "mirror" && (
        <FogMirror
          image={gift.mirror.image}
          fogMessage={gift.mirror.fogMessage}
          underText={gift.mirror.underText}
          onDone={() => {
            setStage("story");
            window.scrollTo(0, 0);
          }}
        />
      )}

      {stage === "story" && (
        <main className={s.story}>
          <section className={s.section}>
            <Reveal>
              <div className={s.kicker} style={{ textAlign: "center" }}>
                11 . 12
              </div>
            </Reveal>
            <Reveal delay={400}>
              <h1 className={s.title} style={{ textAlign: "center" }}>
                two years,
                <br />
                {gift.herNickname}
              </h1>
            </Reveal>
            <Reveal delay={900}>
              <p className={s.sub} style={{ marginTop: 40 }}>
                scroll slowly. some things are worth taking time over.
              </p>
            </Reveal>
          </section>

          <Counter since={since} her={gift.her} stats={gift.stats} />
          <Film {...gift.film} />
          <Letter {...gift.letter} />
          <Moments moments={gift.moments} />

          <section className={`${s.section} ${s.sectionGreen}`}>
            <Reveal>
              <div className={s.kicker} style={{ textAlign: "center" }}>
                for the ones in your hands
              </div>
              <h2 className={s.sectionTitle}>{gift.bouquet.title}</h2>
            </Reveal>
            <Bouquet stems={gift.bouquet.stems} wrap={gift.bouquet.wrap} ribbon={gift.bouquet.ribbon} />
          </section>

          <section className={s.section}>
            <Reveal>
              <div className={s.kicker} style={{ textAlign: "center" }}>
                something that grows
              </div>
              <h2 className={s.sectionTitle}>a piece of the future</h2>
            </Reveal>
            <Reveal delay={200}>
              <StockGift
                ticker={gift.stock.ticker}
                company={gift.stock.company}
                shares={gift.stock.shares}
                amount={gift.stock.amount}
                why={gift.stock.why}
                rule={gift.stock.rule}
                rate={gift.stock.illustrativeAnnualReturn}
                her={gift.her}
                startYear={since.getFullYear()}
              />
            </Reveal>
          </section>

          <Reasons reasons={gift.reasons} />
          <OpenWhen items={gift.openWhen} unlockYear3={year3} />
          <Finale text={gift.finale} me={gift.me} />
        </main>
      )}
    </div>
  );
}

function Locked({ now, unlockAt, her }: { now: number; unlockAt: Date; her: string }) {
  const ms = Math.max(0, unlockAt.getTime() - now);
  const d = Math.floor(ms / 864e5);
  const h = Math.floor(ms / 36e5) % 24;
  const m = Math.floor(ms / 6e4) % 60;
  const sec = Math.floor(ms / 1e3) % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    <div className={s.stage}>
      <div className={s.kicker}>not yet, {her.toLowerCase()}</div>
      <div className={s.bigNum}>
        {d}d {p(h)}h {p(m)}m {p(sec)}s
      </div>
      <p className={s.muted}>this one opens on 11/12. no peeking.</p>
    </div>
  );
}

function Gate({ onPass }: { onPass: () => void }) {
  const [v, setV] = useState("");
  const [bad, setBad] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (gift.gate.answers.map(norm).includes(norm(v))) onPass();
    else {
      setBad(true);
      setTimeout(() => setBad(false), 450);
    }
  };
  return (
    <form className={s.stage} onSubmit={submit}>
      <div className={s.kicker}>for {gift.her.toLowerCase()} only</div>
      <h1 className={s.title} style={{ marginTop: 18 }}>
        {gift.gate.question}
      </h1>
      <input
        className={`${s.gateInput} ${bad ? s.shake : ""}`}
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={gift.gate.hint}
        autoFocus
        inputMode="numeric"
        aria-label={gift.gate.question}
      />
      <button className={s.btn} type="submit">
        open
      </button>
    </form>
  );
}
