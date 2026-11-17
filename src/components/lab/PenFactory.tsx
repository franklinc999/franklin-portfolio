"use client";

import { useEffect, useRef, useState } from "react";
import { field } from "@/lib/field/engine";
import { useMotionOff } from "@/lib/useReducedMotion";

type Level = 1 | 2 | 3;
type OpState = "idle" | "work" | "silent" | "wait";

type Op = {
  id: string;
  role: string;
  job: string;
  /** What lands in the log when a run finishes. */
  out: string;
  level: Level;
  /** Seconds between runs, and seconds a run takes. Zero means it only reacts. */
  every: number;
  takes: number;
  hue: string;
};

const LEVELS: Record<Level, string> = {
  1: "drafts for me",
  2: "acts, then tells me",
  3: "runs on its own",
};

/* Nine operators. The roles are real; the work shown here is made up. */
const OPS: Op[] = [
  { id: "brief", role: "Briefings", job: "Morning brief and to-dos", out: "morning brief", level: 3, every: 9, takes: 2.2, hue: "#ffd166" },
  { id: "route", role: "Router", job: "Routes requests, watches the budget", out: "requests routed", level: 3, every: 6.5, takes: 1.3, hue: "#7cc4ff" },
  { id: "data", role: "Data", job: "Pulls yesterday’s numbers", out: "yesterday’s numbers", level: 2, every: 10, takes: 2.6, hue: "#8ce0b0" },
  { id: "intel", role: "Intel", job: "Reads the public forums", out: "forum roundup", level: 2, every: 8, takes: 2.4, hue: "#c6a3ff" },
  { id: "comms", role: "Comms", job: "Drafts updates and decks", out: "update draft", level: 1, every: 12, takes: 3, hue: "#ff9f7a" },
  { id: "qa", role: "QA", job: "Self-checks every deliverable", out: "", level: 3, every: 0, takes: 0.7, hue: "#f3f6ff" },
  { id: "out", role: "Outbound", job: "Sends, only with my approval", out: "weekly update", level: 1, every: 13, takes: 1.8, hue: "#ff7a9c" },
  { id: "log", role: "Inventory", job: "Keeps the log and the library", out: "library tidied", level: 3, every: 11, takes: 1.6, hue: "#9ad7e6" },
  { id: "fix", role: "Fixer", job: "Watches outcomes, re-runs silent runs", out: "", level: 3, every: 0, takes: 1.2, hue: "#ffe08a" },
];

const QA = OPS.findIndex((o) => o.id === "qa");
const FIX = OPS.findIndex((o) => o.id === "fix");
const OUT = OPS.findIndex((o) => o.id === "out");
const SILENT_EVERY = 6; // one run in six exits clean and does nothing

type Sim = { next: number; left: number; state: OpState; redo: boolean };

/** A pixel operator at a desk. Arms and screen move while it works. */
function Sprite({ hue, state }: { hue: string; state: OpState }) {
  return (
    <svg className="pen-sprite" viewBox="0 0 22 16" data-state={state} aria-hidden="true" focusable="false">
      <rect x="12" y="5" width="8" height="6" className="pen-monitor" />
      <rect x="13" y="6" width="6" height="4" className="pen-screen" style={{ fill: hue }} />
      <rect x="15" y="11" width="2" height="1" className="pen-monitor" />
      <rect x="6" y="0" width="1" height="2" className="pen-metal" />
      <rect x="3" y="2" width="7" height="5" className="pen-metal" />
      <rect x="4" y="4" width="2" height="1" className="pen-eye" />
      <rect x="7" y="4" width="2" height="1" className="pen-eye" />
      <rect x="3" y="8" width="7" height="4" style={{ fill: hue }} />
      <g className="pen-arms">
        <rect x="10" y="9" width="2" height="1" className="pen-metal" />
        <rect x="10" y="11" width="2" height="1" className="pen-metal" />
      </g>
      <rect x="0" y="12" width="22" height="2" className="pen-desk" />
      <rect x="1" y="14" width="1" height="2" className="pen-desk" />
      <rect x="20" y="14" width="1" height="2" className="pen-desk" />
    </svg>
  );
}

/**
 * The Pen Factory, rebuilt as a small model: one process, nine operators,
 * each with a job and an autonomy level. Finished work is self-checked before
 * it lands, a fixer re-runs anything that exits clean but did nothing, and
 * nothing is sent without approval. All of the work shown is invented.
 */
export function PenFactory() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [states, setStates] = useState<OpState[]>(() => OPS.map(() => "idle"));
  const [counts, setCounts] = useState({ delivered: 0, fixed: 0, sent: 0 });
  const [queue, setQueue] = useState<number[]>([]);
  const [log, setLog] = useState<string[]>(["Shift started. 26 jobs on the schedule."]);
  const [standing, setStanding] = useState(false);

  const motionOff = useMotionOff();
  const [started, setStarted] = useState(false);
  const [wasOff, setWasOff] = useState(motionOff);
  if (wasOff !== motionOff) {
    setWasOff(motionOff);
    if (motionOff) setStarted(false);
  }
  const running = (!motionOff || started) && !standing;

  const control = useRef({ running });
  // Approvals still owed. Kept outside React state so the model sees a change at once.
  const pending = useRef(0);
  useEffect(() => {
    control.current.running = running;
  }, [running]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sim: Sim[] = OPS.map((op, i) => ({ next: op.every ? 1.2 + i * 0.9 : 0, left: 0, state: "idle", redo: false }));
    let runs = 0;
    let serial = 0;
    let visible = false;

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(root);

    const say = (line: string) => setLog((l) => [line, ...l].slice(0, 4));
    const show = () => setStates(sim.map((s) => s.state));
    const wake = (i: number) => {
      sim[i].state = "work";
      sim[i].left = OPS[i].takes;
    };

    const stop = field.onFrame((dt) => {
      if (!visible || !control.current.running) return;
      let changed = false;

      for (let i = 0; i < OPS.length; i++) {
        const op = OPS[i];
        const s = sim[i];

        if (s.state === "work" || s.state === "silent") {
          s.left -= dt;
          if (s.left > 0) continue;
          changed = true;

          if (i === QA || i === FIX) {
            s.state = "idle";
            continue;
          }
          if (s.state === "silent") {
            // The fixer noticed. Same job, run again, properly this time.
            wake(FIX);
            s.redo = true;
            wake(i);
            setCounts((c) => ({ ...c, fixed: c.fixed + 1 }));
            say(`Fixer: ${op.role} exited clean but did nothing. Ran it again.`);
            continue;
          }

          runs++;
          if (!s.redo && runs % SILENT_EVERY === 0) {
            s.state = "silent";
            s.left = 1.1;
            continue;
          }
          s.redo = false;
          wake(QA);
          if (i === OUT) {
            s.state = "wait";
            pending.current++;
            const id = ++serial;
            setQueue((q) => [...q, id]);
            say("Outbound: weekly update is ready. Waiting for my approval.");
          } else {
            s.state = "idle";
            s.next = op.every;
            setCounts((c) => ({ ...c, delivered: c.delivered + 1 }));
            say(`${op.role}: ${op.out}, self-checked${op.level === 1 ? ", as a draft" : ""}.`);
          }
          continue;
        }

        if (s.state === "wait") {
          // Released by an approval.
          if (pending.current === 0) {
            s.state = "idle";
            s.next = op.every;
            changed = true;
          }
          continue;
        }

        if (!op.every) continue;
        s.next -= dt;
        if (s.next <= 0) {
          wake(i);
          changed = true;
        }
      }

      if (changed) show();
    });

    return () => {
      stop();
      io.disconnect();
    };
  }, []);

  const approve = (id: number) => {
    pending.current = Math.max(0, pending.current - 1);
    setQueue((q) => q.filter((x) => x !== id));
    setCounts((c) => ({ ...c, sent: c.sent + 1 }));
    setLog((l) => ["Approved. Outbound sent the weekly update.", ...l].slice(0, 4));
  };

  return (
    <div ref={rootRef} className="pen" data-running={running ? "" : undefined}>
      <ol className="pen-floor" aria-label="The nine operators">
        {OPS.map((op, i) => {
          const state = standing ? "idle" : states[i];
          return (
            <li key={op.id} className="pen-room" data-state={state}>
              <Sprite hue={op.hue} state={state} />
              <p className="pen-role">
                <span className="pen-lamp" aria-hidden="true" />
                {op.role}
              </p>
              <p className="pen-job">{op.job}</p>
              <p className="pen-level">
                <span aria-hidden="true">
                  {[1, 2, 3].map((n) => (
                    <i key={n} data-on={n <= op.level ? "" : undefined} />
                  ))}
                </span>
                {LEVELS[op.level]}
              </p>
            </li>
          );
        })}
      </ol>

      <div className="pen-side">
        <dl className="pen-counts">
          <div>
            <dt>Deliverables</dt>
            <dd key={counts.delivered} data-bump={counts.delivered > 0 ? "" : undefined}>
              {counts.delivered}
            </dd>
          </div>
          <div>
            <dt>Silent runs fixed</dt>
            <dd key={counts.fixed} data-bump={counts.fixed > 0 ? "" : undefined}>
              {counts.fixed}
            </dd>
          </div>
          <div>
            <dt>Sent, approved</dt>
            <dd key={counts.sent} data-bump={counts.sent > 0 ? "" : undefined}>
              {counts.sent}
            </dd>
          </div>
        </dl>

        <div className="pen-approvals">
          <p className="meta">Needs my call</p>
          {queue.length === 0 ? (
            <p className="pen-empty">Nothing waiting. Outbound will ask before it sends.</p>
          ) : (
            <ul>
              {queue.map((id) => (
                <li key={id}>
                  <span>Weekly update, ready to send</span>
                  <button type="button" className="btn btn-solid" onClick={() => approve(id)}>
                    Approve
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <ul className="pen-log" aria-label="Latest activity">
          {log.map((line, i) => (
            <li key={`${log.length}-${i}-${line}`}>{line}</li>
          ))}
        </ul>

        <div className="pen-controls">
          {motionOff && !started && !standing && (
            <button type="button" className="btn btn-solid" onClick={() => setStarted(true)}>
              Start the shift
            </button>
          )}
          <button type="button" className="btn btn-glass" aria-pressed={standing} onClick={() => setStanding((v) => !v)}>
            {standing ? "Back to work" : "Stand everything down"}
          </button>
        </div>
      </div>
    </div>
  );
}
