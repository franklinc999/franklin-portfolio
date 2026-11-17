"use client";

import { useEffect, useMemo, useState } from "react";

type Entry = [string, string, string];
type Store = Record<string, Entry>;

const KEY = "three-good-things";
const PROMPTS = ["Something that went well", "Someone who made today better", "A small thing you noticed"];
const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const long = (key: string) => dateOf(key).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
const short = (key: string) => dateOf(key).toLocaleDateString(undefined, { month: "long", day: "numeric" });
const filled = (e?: Entry) => (e ? e.filter((t) => t.trim()).length : 0);

function load(): Store {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    // An empty journal is a fine place to start.
  }
  return {};
}

export function ThreeGoodThings() {
  const [store, setStore] = useState<Store>({});
  const [today, setToday] = useState("");
  const [day, setDay] = useState("");
  const [memory, setMemory] = useState<{ key: string; text: string } | null>(null);
  const [erasing, setErasing] = useState(false);

  // The journal lives in the browser, so it is read after the page has mounted.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const now = keyOf(new Date());
      const saved = load();
      setStore(saved);
      setToday(now);
      setDay(now);
      // Pull one earlier line back out of the pile.
      const past = Object.entries(saved).flatMap(([k, e]) => (k < now ? e.filter((t) => t.trim()).map((text) => ({ key: k, text })) : []));
      if (past.length >= 3) setMemory(past[Math.floor(Math.random() * past.length)]);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const write = (next: Store) => {
    setStore(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage is full or blocked. The page still works until it is closed.
    }
  };

  const setLine = (i: number, text: string) => {
    const entry: Entry = [...(store[day] ?? ["", "", ""])] as Entry;
    entry[i] = text;
    const next = { ...store, [day]: entry };
    if (!filled(entry)) delete next[day];
    write(next);
  };

  const days = useMemo(() => {
    if (!today) return [];
    const end = dateOf(today);
    return Array.from({ length: 35 }, (_, i) => {
      const d = new Date(end);
      d.setDate(end.getDate() - (34 - i));
      return keyOf(d);
    });
  }, [today]);

  const streak = useMemo(() => {
    if (!today) return 0;
    const d = dateOf(today);
    // Today does not break a streak until it is over.
    if (!filled(store[today])) d.setDate(d.getDate() - 1);
    let n = 0;
    while (filled(store[keyOf(d)])) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }, [store, today]);

  const total = Object.values(store).reduce((a, e) => a + filled(e), 0);

  const download = () => {
    const text = Object.keys(store)
      .sort()
      .map((k) => `${long(k)}\n${store[k].filter((t) => t.trim()).map((t) => `  - ${t}`).join("\n")}`)
      .join("\n\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "three-good-things.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const entry = store[day] ?? ["", "", ""];

  return (
    <div className="tool tgt">
      <div className="tgt-page">
        <header className="tool-head">
          <h2 className="h3">{day ? (day === today ? `Today, ${short(day)}` : long(day)) : "Today"}</h2>
          <p className="meta">{streak > 1 ? `${streak} days running` : streak === 1 ? "One day down" : "Three lines. That is the whole thing."}</p>
        </header>
        <ol className="tgt-lines">
          {PROMPTS.map((prompt, i) => (
            <li key={prompt}>
              <label>
                <span className="sr-only">
                  Good thing {i + 1}: {prompt}
                </span>
                <input value={entry[i]} onChange={(e) => setLine(i, e.target.value)} placeholder={prompt} maxLength={160} disabled={!day} autoComplete="off" />
              </label>
            </li>
          ))}
        </ol>
        {day && day !== today && (
          <button type="button" className="text-link" onClick={() => setDay(today)}>
            Back to today
          </button>
        )}
      </div>

      <div className="tgt-side">
        <div>
          <h3 className="meta">The last five weeks</h3>
          <ol className="tgt-days">
            {days.map((k) => (
              <li key={k}>
                <button type="button" data-count={filled(store[k])} aria-pressed={k === day} aria-label={`${short(k)}, ${filled(store[k])} of 3 written`} onClick={() => setDay(k)} />
              </li>
            ))}
          </ol>
        </div>
        {memory && (
          <blockquote className="tgt-memory">
            <p>{memory.text}</p>
            <footer>You, on {short(memory.key)}</footer>
          </blockquote>
        )}
        <p className="tool-note">Kept in this browser only. Nothing you write here is sent anywhere.</p>
        <div className="tool-actions">
          <button type="button" className="btn btn-glass" onClick={download} disabled={!total}>
            Download as text
          </button>
          {erasing ? (
            <>
              <button
                type="button"
                className="btn btn-solid"
                onClick={() => {
                  write({});
                  setMemory(null);
                  setErasing(false);
                }}
              >
                Yes, erase all {total} lines
              </button>
              <button type="button" className="btn btn-glass" onClick={() => setErasing(false)}>
                Keep them
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-glass" onClick={() => setErasing(true)} disabled={!total}>
              Erase everything
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
