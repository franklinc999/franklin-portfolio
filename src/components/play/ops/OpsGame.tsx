"use client";

import { useEffect, useMemo, useState } from "react";
import { sound } from "@/components/play/sound";
import { useMotionOff } from "@/lib/useReducedMotion";
import { CARDS, EVENTS, applyDelta, capacity, cardEffect, newSeason, review, shipWeek, type Card, type Kind, type Meters, type State, type Step } from "./model";

const KIND: Record<Kind, string> = { content: "New content", store: "Store", health: "Upkeep", community: "Community" };
const BEST = "ops-best";

const kindOf = (id: string) => CARDS.find((c) => c.id === id)?.kind ?? "none";
const nameOf = (id: string) => CARDS.find((c) => c.id === id)?.name ?? "";
const sign = (v: number) => (v > 0 ? "+" : "−");
const players = (v: number) => (v >= 100_000 ? `${Math.round(v / 1000)}k` : `${(v / 1000).toFixed(1)}k`);

/** The changes a card or a week makes, as short labelled chips. */
function Chips({ delta }: { delta: Partial<Meters> }) {
  const out: { text: string; good: boolean }[] = [];
  if (delta.players) out.push({ text: `Players ${sign(delta.players)}${(Math.abs(delta.players) / 1000).toFixed(1)}k`, good: delta.players > 0 });
  if (delta.mood) out.push({ text: `Mood ${sign(delta.mood)}${Math.abs(delta.mood)}`, good: delta.mood > 0 });
  if (delta.stability) out.push({ text: `Stability ${sign(delta.stability)}${Math.abs(delta.stability)}`, good: delta.stability > 0 });
  if (delta.energy) out.push({ text: `Team ${sign(delta.energy)}${Math.abs(delta.energy)}`, good: delta.energy > 0 });
  if (delta.revenue) out.push({ text: `Revenue ${sign(delta.revenue)}$${Math.abs(delta.revenue)}k`, good: delta.revenue > 0 });
  if (!out.length) return null;
  return (
    <span className="ops-chips">
      {out.map((c) => (
        <span key={c.text} className="ops-chip" data-tone={c.good ? "good" : "bad"}>
          {c.text}
        </span>
      ))}
    </span>
  );
}

function Meter({ label, value, bar, delta, change, wide, children }: { label: string; value: string; bar?: number; delta?: number; change?: string; wide?: boolean; children?: React.ReactNode }) {
  return (
    <div className="ops-meter" data-wide={wide ? "" : undefined} data-low={bar !== undefined && bar < 35 ? "" : undefined}>
      <dt>{label}</dt>
      <dd>
        {value}
        {delta ? (
          <span className="ops-flash" data-tone={delta > 0 ? "good" : "bad"}>
            {sign(delta)}
            {change ?? Math.abs(delta)}
          </span>
        ) : null}
      </dd>
      {bar !== undefined && (
        <span className="ops-bar" aria-hidden="true">
          <span style={{ width: `${bar}%` }} />
        </span>
      )}
      {children}
    </div>
  );
}

/** Players over the season so far, as a small line. */
function Spark({ points, total }: { points: number[]; total: number }) {
  const lo = Math.min(...points) * 0.92;
  const hi = Math.max(...points) * 1.05;
  const x = (i: number) => (i / total) * 100;
  const y = (v: number) => 28 - ((v - lo) / (hi - lo || 1)) * 24;
  const d = points.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <svg className="ops-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${d} L${x(points.length - 1).toFixed(1)} 30 L0 30 Z`} className="ops-spark-fill" />
      <path d={d} className="ops-spark-line" vectorEffect="non-scaling-stroke" />
    </svg>
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
      <div className="ops ops-intro">
        <p className="meta">Pocket Harbor, the Season of Kites</p>
        <h2 className="h-pixel ops-title">You run the season</h2>
        <p className="ops-lede">
          Pocket Harbor is a cozy co-op game that does not exist. For eight weeks you decide what ships: new things to
          play, things to sell, fixes, and the occasional early Friday. The team can only do so much, the community
          remembers everything, and every week something happens that you did not plan.
        </p>
        <div className="game-actions">
          <button type="button" className="btn btn-solid" onClick={begin}>
            Start the season
          </button>
        </div>
      </div>
    );
  }

  const cap = capacity(season);
  const used = cards.reduce((a, c) => a + c.cost, 0);
  const last = phase === "report" && shown > 0 ? steps[shown - 1].delta : {};
  const trail = [...season.history.map((h) => h.players), ...(phase === "report" ? [meters.players] : [])];
  const result = phase === "done" ? review(season) : null;

  return (
    <div className="ops" data-phase={phase}>
      <header className="ops-head">
        <div>
          <p className="meta">Pocket Harbor, the Season of Kites</p>
          <h2 className="h-pixel ops-week">{phase === "done" ? "Season over" : `Week ${season.week} of ${season.weeks}`}</h2>
        </div>
        <ol className="ops-track" aria-label={`Week ${season.week} of ${season.weeks}`}>
          {Array.from({ length: season.weeks }, (_, i) => (
            <li key={i} data-state={phase === "done" || i + 1 < season.week ? "past" : i + 1 === season.week ? "now" : "ahead"} />
          ))}
        </ol>
        <button type="button" className="btn btn-glass ops-mute" aria-pressed={muted} onClick={mute}>
          {muted ? "Sound off" : "Sound on"}
        </button>
      </header>

      <dl className="ops-meters">
        <Meter label="Players" value={players(meters.players)} delta={last.players} change={last.players ? `${(Math.abs(last.players) / 1000).toFixed(1)}k` : undefined} wide>
          <Spark points={trail} total={season.weeks} />
        </Meter>
        <Meter label="Mood" value={String(meters.mood)} bar={meters.mood} delta={last.mood} />
        <Meter label="Stability" value={String(meters.stability)} bar={meters.stability} delta={last.stability} />
        <Meter label="Team" value={String(meters.energy)} bar={meters.energy} delta={last.energy} />
        <Meter label="Revenue" value={`$${meters.revenue}k`} delta={last.revenue} change={last.revenue ? `$${Math.abs(last.revenue)}k` : undefined} />
      </dl>

      {phase === "plan" && (
        <>
          <p className="ops-omen" data-known={peeked ? "" : undefined}>
            {peeked ? (
              <>
                <b>Coming this week:</b> {EVENTS[season.event].name}. {EVENTS[season.event].hint}
              </>
            ) : (
              "Something happens every week. You find out what after you ship, unless you read the forums first."
            )}
          </p>

          <ul className="ops-hand">
            {season.hand.map((card) => {
              const picked = picks.includes(card.id);
              const blocked = !picked && used + card.cost > cap;
              return (
                <li key={card.id}>
                  <button type="button" className="ops-card" data-kind={card.kind} aria-pressed={picked} aria-disabled={blocked || undefined} onClick={() => toggle(card)}>
                    <span className="ops-card-top">
                      <span className="ops-kind">{KIND[card.kind]}</span>
                      <span className="ops-cost" aria-label={`Takes ${card.cost} of the team's ${cap} points`}>
                        {Array.from({ length: card.cost }, (_, i) => (
                          <i key={i} />
                        ))}
                      </span>
                    </span>
                    <span className="ops-name">{card.name}</span>
                    <span className="ops-line">{card.line}</span>
                    <Chips delta={cardEffect(card, picked ? cards : [...cards, card], season.meters)} />
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="ops-plan">
            <p className="ops-cap">
              <span className="ops-cost ops-cost-big" aria-hidden="true">
                {Array.from({ length: cap }, (_, i) => (
                  <i key={i} data-used={i < used ? "" : undefined} />
                ))}
              </span>
              {used} of {cap} points of work planned
              {cap === 4 ? ". The team is rested." : cap === 2 ? ". The team is worn out." : "."}
            </p>
            <p className="ops-forecast">{cards.length ? <Chips delta={forecast} /> : "Pick what ships this week. Shipping nothing is allowed."}</p>
            <button type="button" className="btn btn-solid" onClick={ship}>
              Ship week {season.week}
            </button>
          </div>
        </>
      )}

      {phase === "report" && (
        <div className="ops-report">
          <ol className="ops-steps" aria-live="polite">
            {steps.slice(0, shown).map((step, i) => (
              <li key={i} className="ops-step" data-tone={step.tone}>
                <span className="ops-step-text">
                  <b>{step.label}</b>
                  {step.detail ? ` ${step.detail}` : ""}
                </span>
                <Chips delta={step.delta} />
              </li>
            ))}
          </ol>
          <div className="game-actions">
            {shown < steps.length ? (
              <button type="button" className="btn btn-glass" onClick={() => setShown(steps.length)}>
                Skip to the end of the week
              </button>
            ) : (
              <button type="button" className="btn btn-solid" onClick={advance}>
                {pending?.done ? "See the season review" : `On to week ${season.week + 1}`}
              </button>
            )}
          </div>
        </div>
      )}

      {result && (
        <div className="ops-review" role="status">
          <p className="h-pixel ops-grade" data-grade={result.grade}>
            {result.grade}
          </p>
          <div className="ops-review-body">
            <h3 className="h3">{result.headline}</h3>
            <p className="meta">
              Score {result.score}
              {result.score >= best ? ", your best so far" : `, your best is ${best}`}
            </p>
            <ul className="ops-notes">
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <ol className="ops-season" aria-label="What shipped, week by week">
              {season.shipped.map((ids, i) => (
                <li key={i}>
                  <span className="ops-season-week">Week {i + 1}</span>
                  <span className="ops-season-pips">
                    {ids.length ? ids.map((id) => <i key={id} data-kind={kindOf(id)} title={nameOf(id)} />) : <i data-kind="none" title="Nothing shipped" />}
                  </span>
                  <span className="ops-season-players">{players(season.history[i + 1].players)}</span>
                </li>
              ))}
            </ol>
            <p className="ops-key">
              {(Object.keys(KIND) as Kind[]).map((k) => (
                <span key={k}>
                  <i data-kind={k} />
                  {KIND[k]}
                </span>
              ))}
            </p>
            <div className="game-actions">
              <button type="button" className="btn btn-solid" onClick={begin}>
                Run another season
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
