"use client";

import { useEffect, useState } from "react";

type Person = { id: string; name: string; every: number; calls: string[] };

const KEY = "call-home";
const EVERY = [
  { days: 7, label: "Every week" },
  { days: 14, label: "Every two weeks" },
  { days: 30, label: "Every month" },
];
const STARTERS = ["Mom", "Dad", "Grandma", "Grandpa"];
const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const between = (a: string, b: string) => Math.round((dateOf(b).getTime() - dateOf(a).getTime()) / 86_400_000);

function load(): Person[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Person[];
  } catch {
    // Start with nobody on the list.
  }
  return [];
}

function status(p: Person, today: string) {
  const last = p.calls[p.calls.length - 1];
  if (!last) return { since: null as number | null, ratio: 1, text: "No call logged yet.", late: true };
  const since = between(last, today);
  if (since <= 0) return { since: 0, ratio: 0, text: "You called today.", late: false };
  if (since < p.every) return { since, ratio: since / p.every, text: `Called ${since === 1 ? "yesterday" : `${since} days ago`}. Next one within ${p.every - since} ${p.every - since === 1 ? "day" : "days"}.`, late: false };
  return { since, ratio: 1, text: `It has been ${since} days. Today would be a good day.`, late: true };
}

export function CallHome() {
  const [people, setPeople] = useState<Person[]>([]);
  const [today, setToday] = useState("");
  const [name, setName] = useState("");
  const [every, setEvery] = useState(7);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setPeople(load());
      setToday(keyOf(new Date()));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const write = (next: Person[]) => {
    setPeople(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage is blocked. The list still works until the page is closed.
    }
  };

  const add = (who: string) => {
    const clean = who.trim();
    if (!clean || people.some((p) => p.name.toLowerCase() === clean.toLowerCase())) return;
    write([...people, { id: `${Date.now()}`, name: clean, every, calls: [] }]);
    setName("");
  };
  const patch = (id: string, change: (p: Person) => Person) => write(people.map((p) => (p.id === id ? change(p) : p)));
  const called = (id: string) => patch(id, (p) => ({ ...p, calls: [...p.calls.filter((c) => c !== today), today].slice(-24) }));
  const undo = (id: string) => patch(id, (p) => ({ ...p, calls: p.calls.filter((c) => c !== today) }));

  // One repeating reminder per person, starting when the next call is due.
  const calendar = () => {
    const stamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const events = people.map((p) => {
      const last = p.calls[p.calls.length - 1];
      const due = last ? dateOf(last) : dateOf(today);
      if (last) due.setDate(due.getDate() + p.every);
      if (keyOf(due) < today) due.setTime(dateOf(today).getTime());
      return ["BEGIN:VEVENT", `UID:call-${p.id}@franklin.rocks`, `DTSTAMP:${stamp(new Date())}T000000Z`, `DTSTART:${stamp(due)}T180000`, `DTEND:${stamp(due)}T183000`, `RRULE:FREQ=DAILY;INTERVAL=${p.every}`, `SUMMARY:Call ${p.name.replace(/[,;\\]/g, " ")}`, "END:VEVENT"].join("\r\n");
    });
    const text = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//franklin.rocks//Call Home//EN", ...events, "END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "call-home.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  const sorted = today ? [...people].sort((a, b) => (status(b, today).since ?? 999) / b.every - (status(a, today).since ?? 999) / a.every) : people;
  const starters = STARTERS.filter((s) => !people.some((p) => p.name.toLowerCase() === s.toLowerCase()));

  return (
    <div className="tool call">
      {sorted.length === 0 ? (
        <p className="call-empty">Nobody on the list yet. Add the people you mean to call more than you do.</p>
      ) : (
        <ul className="call-list">
          {sorted.map((p) => {
            const s = status(p, today);
            const turn = 2 * Math.PI * 26;
            return (
              <li key={p.id} className="call-person" data-late={s.late ? "" : undefined}>
                <svg className="call-ring" viewBox="0 0 64 64" aria-hidden="true">
                  <circle cx="32" cy="32" r="26" />
                  <circle cx="32" cy="32" r="26" strokeDasharray={`${turn * s.ratio} ${turn}`} transform="rotate(-90 32 32)" />
                  <text x="32" y="33" textAnchor="middle" dominantBaseline="middle">
                    {s.since === null ? "?" : s.since}
                  </text>
                </svg>
                <div className="call-body">
                  <h3 className="h3">{p.name}</h3>
                  <p>{s.text}</p>
                  <label className="call-every">
                    <span className="sr-only">How often to call {p.name}</span>
                    <select value={p.every} onChange={(e) => patch(p.id, (x) => ({ ...x, every: Number(e.target.value) }))}>
                      {EVERY.map((o) => (
                        <option key={o.days} value={o.days}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="call-actions">
                  {s.since === 0 ? (
                    <button type="button" className="btn btn-glass" onClick={() => undo(p.id)}>
                      Undo
                    </button>
                  ) : (
                    <button type="button" className="btn btn-solid" onClick={() => called(p.id)}>
                      I called today
                    </button>
                  )}
                  <button type="button" className="call-remove" aria-label={`Remove ${p.name}`} onClick={() => write(people.filter((x) => x.id !== p.id))}>
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="call-add"
        onSubmit={(e) => {
          e.preventDefault();
          add(name);
        }}
      >
        <label className="field-row">
          <span>Who</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="A name" maxLength={40} autoComplete="off" />
        </label>
        <label className="field-row">
          <span>How often</span>
          <select value={every} onChange={(e) => setEvery(Number(e.target.value))}>
            {EVERY.map((o) => (
              <option key={o.days} value={o.days}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-solid" disabled={!name.trim()}>
          Add
        </button>
      </form>
      {starters.length > 0 && (
        <p className="call-starters">
          Or start with
          {starters.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => add(s)}>
              {s}
            </button>
          ))}
        </p>
      )}

      <div className="tool-actions">
        <button type="button" className="btn btn-glass" onClick={calendar} disabled={!people.length}>
          Put reminders on my calendar
        </button>
      </div>
      <p className="tool-note">Kept in this browser only. The calendar file is made on your device and sent nowhere.</p>
    </div>
  );
}
