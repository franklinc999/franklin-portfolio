"use client";

import { useEffect, useMemo, useState } from "react";
import { sound } from "@/components/play/sound";
import { useMotionOff } from "@/lib/useReducedMotion";
import { Harbor } from "./Harbor";
import "./harbor.css";
import { CARDS, EVENTS, applyDelta, capacity, cardEffect, newSeason, review, shipWeek, type Card, type Kind, type Meters, type State, type Step } from "./model";

const KIND: Record<Kind, string> = { content: "Something new", store: "For sale", health: "Upkeep", community: "For the town" };
const BEST = "ops-best";

const kindOf = (id: string) => CARDS.find((c) => c.id === id)?.kind ?? "none";
const nameOf = (id: string) => CARDS.find((c) => c.id === id)?.name ?? "";
const sign = (v: number) => (v > 0 ? "+" : "−");
const players = (v: number) => (v >= 100_000 ? `${Math.round(v / 1000)}k` : `${(v / 1000).toFixed(1)}k`);

/** What a card or a week changes, as a short run of plus and minus figures. */
function Changes({ delta }: { delta: Partial<Meters> }) {
  const out: { text: string; good: boolean }[] = [];
  if (delta.players) out.push({ text: `Players ${sign(delta.players)}${(Math.abs(delta.players) / 1000).toFixed(1)}k`, good: delta.players > 0 });
  if (delta.mood) out.push({ text: `Mood ${sign(delta.mood)}${Math.abs(delta.mood)}`, good: delta.mood > 0 });
  if (delta.stability) out.push({ text: `Stability ${sign(delta.stability)}${Math.abs(delta.stability)}`, good: delta.stability > 0 });
  if (delta.energy) out.push({ text: `Crew ${sign(delta.energy)}${Math.abs(delta.energy)}`, good: delta.energy > 0 });
  if (delta.revenue) out.push({ text: `Takings ${sign(delta.revenue)}$${Math.abs(delta.revenue)}k`, good: delta.revenue > 0 });
  if (!out.length) return null;
  return (
    <span className="hb-changes">
      {out.map((c) => (
        <span key={c.text} data-tone={c.good ? "good" : "bad"}>
          {c.text}
        </span>
      ))}
    </span>
  );
}

function Entry({ label, value, bar, delta, change }: { label: string; value: string; bar?: number; delta?: number; change?: string }) {
  return (
    <div className="hb-entry" data-low={bar !== undefined && bar < 35 ? "" : undefined}>
      <dt>{label}</dt>
      <dd>
        {value}
        {delta ? (
          <span className="hb-flash" data-tone={delta > 0 ? "good" : "bad"}>
            {sign(delta)}
            {change ?? Math.abs(delta)}
          </span>
        ) : null}
      </dd>
      {bar !== undefined && (
        <span className="hb-rule" aria-hidden="true">
          <span style={{ width: `${bar}%` }} />
        </span>
      )}
    </div>
  );
}

export default function OpsGame() {
  const motionOff = useMotionOff();
  const [season, setSeason] = useState<State | null>(null);
  const [pending, setPending] = useState<State | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [shown, setShown] = useState(0);
  const [picks, setPicks] = useState<string[]>([]);
  const [peeked, setPeeked] = useState(false);
  const [phase, setPhase] = useState<"intro" | "plan" | "report" | "done">("intro");
  const [best, setBest] = useState(0);
  const [muted, setMuted] = useState(false);

  // Each line of the week lands on its own beat, so you can watch a choice pay off or bite.
  useEffect(() => {
    if (phase !== "report" || shown >= steps.length) return;
    const id = window.setTimeout(
      () => {
        const step = steps[shown];
        if (step.tone === "bad") sound.bad();
        else if (step.tone === "good") sound.good();
        setShown((n) => n + 1);
      },
      shown === 0 ? 320 : 640,
    );
    return () => window.clearTimeout(id);
  }, [phase, shown, steps]);

  const cards = useMemo(() => (season ? picks.map((id) => season.hand.find((c) => c.id === id)).filter((c): c is Card => !!c) : []), [season, picks]);

  // During the report the meters replay the week one line at a time.
  const meters = useMemo(() => {
    if (!season) return null;
    if (phase !== "report") return season.meters;
    return steps.slice(0, shown).reduce((m, s) => applyDelta(m, s.delta), season.meters);
  }, [season, phase, steps, shown]);

  const forecast = useMemo(() => {
    if (!season) return {};
    let m = season.meters;
    const total: Partial<Meters> = {};
    for (const card of cards) {
      const d = cardEffect(card, cards, m);
      for (const key of Object.keys(d) as (keyof Meters)[]) total[key] = (total[key] ?? 0) + (d[key] ?? 0);
      m = applyDelta(m, d);
    }
    return total;
  }, [season, cards]);

  const begin = () => {
    const asked = Number(new URLSearchParams(window.location.search).get("seed"));
    let stored = 0;
    try {
      stored = Number(window.localStorage.getItem(BEST)) || 0;
    } catch {
      // No best yet.
    }
    setBest(stored);
    setSeason(newSeason(asked || Date.now() % 2147483647));
    setPending(null);
    setPicks([]);
    setPeeked(false);
    setSteps([]);
    setPhase("plan");
  };

  const toggle = (card: Card) => {
    if (!season || phase !== "plan") return;
    const has = picks.includes(card.id);
    // Once you have read the forums you cannot unread them.
    if (has && card.id === "forums") return;
    if (!has && cards.reduce((a, c) => a + c.cost, 0) + card.cost > capacity(season)) return;
    sound.pop();
    if (!has && card.id === "forums") setPeeked(true);
    setPicks(has ? picks.filter((id) => id !== card.id) : [...picks, card.id]);
  };

  const ship = () => {
    if (!season) return;
    const result = shipWeek(season, cards);
    setSteps(result.steps);
    setShown(motionOff ? result.steps.length : 0);
    setPending(result.state);
    setPhase("report");
  };

  const advance = () => {
    if (!pending) return;
    setSeason(pending);
    setPending(null);
    setPicks([]);
    setPeeked(false);
    setSteps([]);
    if (pending.done) {
      const score = review(pending).score;
      if (score > best) {
        setBest(score);
        try {
          window.localStorage.setItem(BEST, String(score));
        } catch {
          // The best score is a nicety.
        }
      }
      sound.end();
      setPhase("done");
    } else {
      setPhase("plan");
    }
  };

  const mute = () => {
    sound.setMuted(!muted);
    setMuted(!muted);
  };

  if (phase === "intro" || !season || !meters) {
    return (
      <div className="hb hb-cover">
        <Harbor meters={{ players: 120000, mood: 70, stability: 68, energy: 78, revenue: 120 }} />
        <div className="hb-cover-text">
          <p className="hb-kicker">The harbor master&rsquo;s ledger</p>
          <h2 className="hb-name">Pocket Harbor</h2>
          <p className="hb-lede">
            Pocket Harbor is a cozy co-op game that does not exist. For eight weeks you decide what ships: new things
            to play, things to sell, fixes, and the occasional early Friday. The crew can only do so much, the town
            remembers everything, and every week something happens that you did not plan.
          </p>
          <button type="button" className="hb-go" onClick={begin}>
            Open the ledger
          </button>
        </div>
      </div>
    );
  }

  const cap = capacity(season);
  const used = cards.reduce((a, c) => a + c.cost, 0);
  const last = phase === "report" && shown > 0 ? steps[shown - 1].delta : {};
  const result = phase === "done" ? review(season) : null;

  return (
    <div className="hb" data-phase={phase}>
      <header className="hb-head">
        <div>
          <p className="hb-kicker">Pocket Harbor, the Season of Kites</p>
          <h2 className="hb-week">{phase === "done" ? "The season is over" : `Week ${season.week} of ${season.weeks}`}</h2>
        </div>
        <ol className="hb-buoys" aria-label={`Week ${season.week} of ${season.weeks}`}>
          {Array.from({ length: season.weeks }, (_, i) => (
            <li key={i} data-state={phase === "done" || i + 1 < season.week ? "past" : i + 1 === season.week ? "now" : "ahead"}>
              {i + 1}
            </li>
          ))}
        </ol>
        <button type="button" className="hb-quiet" aria-pressed={!muted} onClick={mute}>
          Sound {muted ? "off" : "on"}
        </button>
      </header>

      <Harbor meters={meters} />

      <dl className="hb-entries">
        <Entry label="Players" value={players(meters.players)} delta={last.players} change={last.players ? `${(Math.abs(last.players) / 1000).toFixed(1)}k` : undefined} />
        <Entry label="Mood" value={String(meters.mood)} bar={meters.mood} delta={last.mood} />
        <Entry label="Stability" value={String(meters.stability)} bar={meters.stability} delta={last.stability} />
        <Entry label="Crew" value={String(meters.energy)} bar={meters.energy} delta={last.energy} />
        <Entry label="Takings" value={`$${meters.revenue}k`} delta={last.revenue} change={last.revenue ? `$${Math.abs(last.revenue)}k` : undefined} />
      </dl>

      {phase === "plan" && (
        <>
          <p className="hb-bottle" data-known={peeked ? "" : undefined}>
            {peeked ? (
              <>
                <b>Word from the forums:</b> {EVENTS[season.event].name}. {EVENTS[season.event].hint}
              </>
            ) : (
              "Something happens every week. You find out what after you ship, unless you read the forums first."
            )}
          </p>

          <ul className="hb-hand">
            {season.hand.map((card) => {
              const picked = picks.includes(card.id);
              const blocked = !picked && used + card.cost > cap;
              return (
                <li key={card.id}>
                  <button type="button" className="hb-tag" data-kind={card.kind} aria-pressed={picked} aria-disabled={blocked || undefined} onClick={() => toggle(card)}>
                    <span className="hb-tag-top">
                      <span className="hb-flag" aria-hidden="true" />
                      <span className="hb-kind">{KIND[card.kind]}</span>
                      <span className="hb-hands" aria-label={`Takes ${card.cost} of the crew's ${cap} hands`}>
                        {Array.from({ length: card.cost }, (_, i) => (
                          <i key={i} />
                        ))}
                      </span>
                    </span>
                    <span className="hb-tag-name">{card.name}</span>
                    <span className="hb-tag-line">{card.line}</span>
                    <Changes delta={cardEffect(card, picked ? cards : [...cards, card], season.meters)} />
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="hb-plan">
            <p className="hb-crew">
              <span className="hb-hands hb-hands-big" aria-hidden="true">
                {Array.from({ length: cap }, (_, i) => (
                  <i key={i} data-used={i < used ? "" : undefined} />
                ))}
              </span>
              {used} of {cap} hands busy
              {cap === 4 ? ". The crew is rested." : cap === 2 ? ". The crew is worn out." : "."}
            </p>
            <p className="hb-forecast">{cards.length ? <Changes delta={forecast} /> : "Pick what ships this week. Shipping nothing is allowed."}</p>
            <button type="button" className="hb-go" onClick={ship}>
              Ship week {season.week}
            </button>
          </div>
        </>
      )}

      {phase === "report" && (
        <div className="hb-log">
          <h3 className="hb-log-title">The week, as it happened</h3>
          <ol aria-live="polite">
            {steps.slice(0, shown).map((step, i) => (
              <li key={i} data-tone={step.tone}>
                <span>
                  <b>{step.label}.</b>
                  {step.detail ? ` ${step.detail}` : ""}
                </span>
                <Changes delta={step.delta} />
              </li>
            ))}
          </ol>
          {shown < steps.length ? (
            <button type="button" className="hb-quiet" onClick={() => setShown(steps.length)}>
              Skip to the end of the week
            </button>
          ) : (
            <button type="button" className="hb-go" onClick={advance}>
              {pending?.done ? "Read the season report" : `On to week ${season.week + 1}`}
            </button>
          )}
        </div>
      )}

      {result && (
        <div className="hb-report" role="status">
          <p className="hb-seal" data-grade={result.grade}>
            {result.grade}
          </p>
          <div className="hb-report-body">
            <h3 className="hb-report-title">{result.headline}</h3>
            <p className="hb-kicker">
              Score {result.score}
              {result.score >= best ? ", your best so far" : `, your best is ${best}`}
            </p>
            <ul className="hb-notes">
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <ol className="hb-season" aria-label="What shipped, week by week">
              {season.shipped.map((ids, i) => (
                <li key={i}>
                  <span>Week {i + 1}</span>
                  <span className="hb-season-flags">
                    {ids.length ? ids.map((id) => <i key={id} className="hb-flag" data-kind={kindOf(id)} title={nameOf(id)} />) : <i className="hb-flag" data-kind="none" title="Nothing shipped" />}
                  </span>
                  <b>{players(season.history[i + 1].players)}</b>
                </li>
              ))}
            </ol>
            <p className="hb-key">
              {(Object.keys(KIND) as Kind[]).map((k) => (
                <span key={k}>
                  <i className="hb-flag" data-kind={k} />
                  {KIND[k]}
                </span>
              ))}
            </p>
            <button type="button" className="hb-go" onClick={begin}>
              Run another season
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
