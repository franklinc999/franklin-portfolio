"use client";

import { useEffect, useMemo, useState } from "react";
import { HOLIDAYS, plan, yearDays, type Style } from "./pto";

const STYLES: { id: Style; name: string; what: string }[] = [
  { id: "weekends", name: "Long weekends", what: "A day or two at a time, next to weekends and holidays." },
  { id: "trips", name: "A few trips", what: "Blocks of three to five days, a week or more away each." },
  { id: "big", name: "One big trip", what: "One long stretch first, then long weekends with what is left." },
];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const short = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function PtoPlanner() {
  const [today, setToday] = useState<Date | null>(null);
  const [year, setYear] = useState(0);
  const [budget, setBudget] = useState("15");
  const [style, setStyle] = useState<Style>("weekends");
  const [picked, setPicked] = useState(() => new Set(HOLIDAYS.filter((h) => h.on).map((h) => h.id)));
  const [copied, setCopied] = useState(false);

  // The date is read after the page has mounted, so the server and the browser agree on the first paint.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const now = new Date();
      setToday(now);
      // Late in the year, next year is the one worth planning.
      setYear(now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear());
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const n = Math.max(0, Math.min(40, Math.floor(Number(budget)) || 0));
  const days = useMemo(() => (today && year ? yearDays(year, picked, today) : []), [today, year, picked]);
  const breaks = useMemo(() => (days.length && n ? plan(days, n, style) : []), [days, n, style]);

  const taken = new Set(breaks.flatMap((b) => b.take));
  const away = new Set(breaks.flatMap((b) => Array.from({ length: b.to - b.from + 1 }, (_, i) => b.from + i)));
  const spent = taken.size;
  const total = away.size;

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const copy = async () => {
    const text = [`PTO plan for ${year}: ${spent} days of leave, ${total} days off`, ...breaks.map((b) => `${fmt(days[b.from].date)} to ${fmt(days[b.to].date)} (${b.length} days off). Take: ${b.take.map((i) => short(days[i].date)).join(", ")}`)].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Copying is a convenience. The plan is on the page either way.
    }
  };

  if (!today || !year) return <div className="tool pto" aria-busy="true" />;
  const thisYear = today.getFullYear();

  return (
    <div className="tool pto">
      <div className="pto-top">
        <div className="pto-form">
          <div className="pto-row">
            <label className="field-row">
              <span>Days of PTO to spend</span>
              <input inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} aria-invalid={!(n > 0)} />
            </label>
            <fieldset className="seg" aria-label="Year">
              {[thisYear, thisYear + 1].map((y) => (
                <label key={y} className="seg-item">
                  <input type="radio" name="pto-year" checked={year === y} onChange={() => setYear(y)} />
                  <span>{y === thisYear ? `Rest of ${y}` : y}</span>
                </label>
              ))}
            </fieldset>
          </div>

          <fieldset className="pto-styles">
            <legend className="meta">How you like your time off</legend>
            {STYLES.map((s) => (
              <label key={s.id}>
                <input type="radio" name="pto-style" checked={style === s.id} onChange={() => setStyle(s.id)} />
                <span>
                  <b>{s.name}</b>
                  {s.what}
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="pto-holidays">
            <legend className="meta">Holidays your company gives you</legend>
            {HOLIDAYS.map((h) => (
              <label key={h.id}>
                <input type="checkbox" checked={picked.has(h.id)} onChange={() => toggle(h.id)} />
                <span>{h.name}</span>
              </label>
            ))}
          </fieldset>
        </div>

        <div className="pto-plan" role="status">
          {breaks.length ? (
            <>
              <p className="pto-sum">
                <b>{total}</b> days off
              </p>
              <p className="pto-sub">
                from {spent} {spent === 1 ? "day" : "days"} of PTO, in {breaks.length} {breaks.length === 1 ? "break" : "breaks"}.
                {spent < n ? ` ${n - spent} left over.` : ""}
              </p>
              <ol className="pto-breaks">
                {breaks.map((b) => (
                  <li key={b.from}>
                    <b>
                      {fmt(days[b.from].date)} to {fmt(days[b.to].date)}
                    </b>
                    <span>
                      {b.length} days off for {b.take.length}. Take {b.take.map((i) => short(days[i].date)).join(", ")}.
                    </span>
                  </li>
                ))}
              </ol>
              <div className="tool-actions">
                <button type="button" className="btn btn-glass" onClick={copy}>
                  {copied ? "Copied" : "Copy the dates"}
                </button>
              </div>
            </>
          ) : (
            <p className="pto-sub">{n > 0 ? "No working days left to plan in this stretch of the year." : "Enter how many days of PTO you have to spend."}</p>
          )}
        </div>
      </div>

      <div className="pto-year" aria-label={`Calendar for ${year}`}>
        {MONTHS.map((name, m) => {
          const first = days.findIndex((d) => d.date.getMonth() === m);
          const inMonth = days.filter((d) => d.date.getMonth() === m);
          return (
            <div key={name} className="pto-month">
              <h3>{name}</h3>
              <ol style={{ "--lead": inMonth[0].date.getDay() } as React.CSSProperties}>
                {inMonth.map((d, i) => {
                  const at = first + i;
                  const kind = taken.has(at) ? "take" : d.holiday ? "holiday" : d.weekend ? "weekend" : "work";
                  return (
                    <li key={at} data-kind={kind} data-away={away.has(at) ? "" : undefined} data-past={d.past ? "" : undefined} title={taken.has(at) ? "Take this day" : d.holiday || undefined}>
                      {d.date.getDate()}
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
      <p className="pto-key" aria-hidden="true">
        <span data-kind="take">Take</span>
        <span data-kind="holiday">Holiday</span>
        <span data-kind="weekend">Weekend</span>
        <span data-away="">Away</span>
      </p>
      <p className="tool-note">Holiday dates follow the usual US rule: a Saturday holiday is taken on Friday, a Sunday one on Monday. Check your own company calendar. Nothing you enter is saved.</p>
    </div>
  );
}
