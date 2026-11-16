"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { field } from "@/lib/field/engine";
import { useMotionOff } from "@/lib/useReducedMotion";

const STATIONS = [
  { name: "Intake", at: 0.05 },
  { name: "Fetch", at: 0.275 },
  { name: "Check", at: 0.5 },
  { name: "Write", at: 0.725 },
  { name: "Ship", at: 0.95 },
];
const CHECK = 2;
const WRITE = 3;
const SHIP = 4;
const EXIT = 1; // where a shipped task leaves the line

// Stage geometry. The rail sits RAIL percent down a stage STAGE_H px tall,
// and the retry loop hangs LOOP_DEPTH px below it. The drawn loop and the
// path a retried task follows are the same cubic, so they cannot disagree.
const STAGE_H = 140;
const RAIL = 36;
const LOOP_DEPTH = 46;
const LOOP_Y = RAIL + ((LOOP_DEPTH / 0.75) / STAGE_H) * 100;
const LOOP_PATH = `M${STATIONS[2].at * 100} ${RAIL} C${STATIONS[2].at * 100} ${LOOP_Y.toFixed(2)} ${STATIONS[1].at * 100} ${LOOP_Y.toFixed(2)} ${STATIONS[1].at * 100} ${RAIL}`;
const SPEED = 0.21; // share of the line travelled per second
const HOLD = 0.34; // seconds a station spends on a task
const GAP = 0.05; // closest two tasks may sit
const SPAWN_EVERY = 1.2;
const WATCHDOG_AFTER = 3.2; // seconds of silence before the watchdog steps in
const POOL = 12;
const POPS = 3;

type Task = {
  t: number;
  bad: boolean;
  fixed: boolean;
  hold: number;
  next: number; // index of the next station this task has to stop at
  retry: number; // -1 on the line, otherwise 0..1 around the retry loop
};

type Counts = { shipped: number; caught: number; leaked: number; restarts: number };

/**
 * A toy model of an agent pipeline. Tasks ride the line from intake to ship;
 * the checker pulls bad ones off and sends them round again, and a watchdog
 * restarts a station that goes quiet. Switch the checker off, or stall the
 * writer, and watch what the line does without them.
 */
export function AgentLine() {
  const rootRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const tokenRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const stationRefs = useRef<(HTMLLIElement | null)[]>([]);
  const dogRef = useRef<HTMLSpanElement>(null);
  const popRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const popNext = useRef(0);

  const [counts, setCounts] = useState<Counts>({ shipped: 0, caught: 0, leaked: 0, restarts: 0 });
  const [checker, setChecker] = useState(true);
  const [stalled, setStalled] = useState(false);
  // With motion turned down or paused, the line waits to be started by hand.
  const motionOff = useMotionOff();
  const [started, setStarted] = useState(false);
  // Pausing motion later stops a line that was started by hand.
  const [wasOff, setWasOff] = useState(motionOff);
  if (wasOff !== motionOff) {
    setWasOff(motionOff);
    if (motionOff) setStarted(false);
  }
  const running = !motionOff || started;
  const [note, setNote] = useState("Everything is flowing.");

  const control = useRef({ checker: true, stalled: false, running: true, sendBad: false });

  useEffect(() => {
    control.current.checker = checker;
  }, [checker]);
  useEffect(() => {
    control.current.stalled = stalled;
  }, [stalled]);
  useEffect(() => {
    control.current.running = running;
  }, [running]);

  useEffect(() => {
    const root = rootRef.current;
    const line = lineRef.current;
    if (!root || !line) return;

    const tasks: Task[] = [];
    let spawn = 0.4;
    let quiet = 0;
    let visible = false;
    let spawned = 0;
    let shippedAny = false;
    const active = STATIONS.map(() => 0);

    // A ring that bursts from a station at the moment something happens there.
    const pop = (station: number, kind: "good" | "bad") => {
      const el = popRefs.current[popNext.current++ % POPS];
      if (!el) return;
      el.style.left = `${STATIONS[station].at * 100}%`;
      el.dataset.kind = kind;
      const still = field.reducedMotion;
      el.animate(
        still
          ? [{ opacity: 0.9 }, { opacity: 0 }]
          : [
              { transform: "translate(-50%, -50%) scale(0.55)", opacity: 0.95 },
              { transform: "translate(-50%, -50%) scale(2.3)", opacity: 0 },
            ],
        { duration: 480, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(root);

    const stop = field.onFrame((dt) => {
      const c = control.current;
      if (!visible || !c.running) return;

      // New work arrives on a steady beat, as long as intake has room.
      spawn -= dt;
      const first = tasks[tasks.length - 1];
      if (spawn <= 0 && tasks.length < POOL - 1 && (!first || first.retry >= 0 || first.t > GAP * 1.6)) {
        spawned++;
        const bad = c.sendBad || spawned % 9 === 0;
        c.sendBad = false;
        tasks.push({ t: 0, bad, fixed: false, hold: 0, next: 0, retry: -1 });
        spawn = SPAWN_EVERY;
      }

      // Furthest along first, so each task can see how much room the one ahead left it.
      let ahead = 2;
      let resort = false;
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];

        if (task.retry >= 0) {
          task.retry = Math.min(1, task.retry + dt / 1.05);
          // Rejoin at Fetch once there is a gap to drop into.
          const fetchAt = STATIONS[1].at;
          const clear = tasks.every((o) => o === task || o.retry >= 0 || Math.abs(o.t - fetchAt) > GAP);
          if (task.retry >= 1 && clear) {
            task.retry = -1;
            task.bad = false;
            task.fixed = true;
            task.t = fetchAt;
            task.next = 1;
            task.hold = HOLD;
            resort = true;
          }
          continue;
        }

        if (task.hold > 0) {
          const station = Math.max(0, task.next);
          active[station] = 0.25;
          if (!(c.stalled && station === WRITE)) task.hold -= dt;
          if (task.hold <= 0) {
            task.hold = 0;
            if (station === CHECK && task.bad && c.checker) {
              task.retry = 0;
              pop(CHECK, "good");
              setCounts((n) => ({ ...n, caught: n.caught + 1 }));
              setNote("The checker caught a bad one and sent it back round.");
              continue;
            }
            task.next = station + 1;
          }
          ahead = task.t;
          continue;
        }

        const stopAt = task.next < STATIONS.length ? STATIONS[task.next].at : 2;
        const limit = Math.min(stopAt, ahead - GAP);
        task.t = Math.max(task.t, Math.min(limit, task.t + SPEED * dt));
        if (task.next < STATIONS.length && task.t >= stopAt - 1e-4) {
          task.t = stopAt;
          task.hold = HOLD;
        }
        ahead = task.t;
      }

      if (resort) tasks.sort((a, b) => b.t - a.t);

      // Ship whatever reached the end of the line.
      for (let i = tasks.length - 1; i >= 0; i--) {
        const task = tasks[i];
        if (task.retry < 0 && task.next >= STATIONS.length && task.t >= EXIT) {
          tasks.splice(i, 1);
          quiet = 0;
          shippedAny = true;
          if (task.bad) {
            pop(SHIP, "bad");
            setCounts((n) => ({ ...n, leaked: n.leaked + 1 }));
            setNote("A bad one shipped. Nothing was checking.");
          } else {
            setCounts((n) => ({ ...n, shipped: n.shipped + 1 }));
          }
        }
      }

      // The watchdog only watches the far end: if nothing ships for a while,
      // something upstream is stuck, and it restarts it.
      if (shippedAny || c.stalled) quiet += dt;
      if (quiet >= WATCHDOG_AFTER && c.stalled) {
        c.stalled = false;
        pop(WRITE, "good");
        setStalled(false);
        setCounts((n) => ({ ...n, restarts: n.restarts + 1 }));
        setNote("Nothing shipped for three seconds, so the watchdog restarted the writer.");
        quiet = 0;
      }
      const dog = dogRef.current;
      if (dog) {
        dog.style.setProperty("--fill", Math.min(1, quiet / WATCHDOG_AFTER).toFixed(3));
        if (c.stalled && quiet > WATCHDOG_AFTER * 0.5) dog.dataset.alert = "";
        else delete dog.dataset.alert;
      }

      // Paint.
      const w = line.clientWidth;
      for (let i = 0; i < POOL; i++) {
        const el = tokenRefs.current[i];
        if (!el) continue;
        const task = tasks[i];
        if (!task) {
          el.style.opacity = "0";
          continue;
        }
        let x = task.t * w;
        let y = 0;
        if (task.retry >= 0) {
          // The same curve the dashed loop is drawn with: a cubic whose
          // handles hang straight down from Check and Fetch.
          const u = task.retry * task.retry * (3 - 2 * task.retry);
          const e = u * u * (3 - 2 * u);
          x = (STATIONS[CHECK].at + (STATIONS[1].at - STATIONS[CHECK].at) * e) * w;
          y = 4 * LOOP_DEPTH * u * (1 - u);
        }
        // Tasks grow in at intake and thin out past ship, so nothing pops.
        const coming = Math.min(1, task.t / 0.035);
        const going = task.next >= STATIONS.length ? Math.max(0, 1 - (task.t - STATIONS[SHIP].at) / (EXIT - STATIONS[SHIP].at)) : 1;
        const shown = task.retry >= 0 ? 1 : coming * going;
        el.style.opacity = shown.toFixed(2);
        el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${(0.6 + 0.4 * shown).toFixed(3)})`;
        el.dataset.kind = task.bad ? "bad" : task.fixed ? "fixed" : "good";
      }
      for (let i = 0; i < STATIONS.length; i++) {
        active[i] = Math.max(0, active[i] - dt);
        const el = stationRefs.current[i];
        if (!el) continue;
        if (active[i] > 0) el.dataset.busy = "";
        else delete el.dataset.busy;
      }
    });

    return () => {
      io.disconnect();
      stop();
    };
  }, []);

  const sendBad = () => {
    control.current.sendBad = true;
    setNote(checker ? "A bad task is on its way. Watch the checker." : "A bad task is on its way, and the checker is off.");
  };

  return (
    <div ref={rootRef} className="line">
      <div className="line-head">
        <p className="line-note" aria-live="polite">
          {note}
        </p>
        <span ref={dogRef} className="line-dog">
          <span className="line-dog-ring" aria-hidden="true" />
          watchdog
        </span>
      </div>

      <div className="line-stage" style={{ height: STAGE_H, "--rail": `${RAIL}%` } as CSSProperties}>
        <svg className="line-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path className="line-rail" d={`M5 ${RAIL} H100`} />
          <path className="line-loop" d={LOOP_PATH} data-off={checker ? undefined : ""} />
        </svg>
        <ol className="line-stations">
          {STATIONS.map((station, i) => (
            <li
              key={station.name}
              ref={(el) => {
                stationRefs.current[i] = el;
              }}
              style={{ left: `${station.at * 100}%` }}
              data-off={(i === CHECK && !checker) || (i === WRITE && stalled) ? "" : undefined}
            >
              <span className="line-node" aria-hidden="true" />
              <span className="line-label">{station.name}</span>
            </li>
          ))}
        </ol>
        <div ref={lineRef} className="line-tokens" aria-hidden="true">
          {Array.from({ length: POOL }, (_, i) => (
            <span
              key={i}
              ref={(el) => {
                tokenRefs.current[i] = el;
              }}
              className="line-token"
            />
          ))}
          {Array.from({ length: POPS }, (_, i) => (
            <span
              key={`pop-${i}`}
              ref={(el) => {
                popRefs.current[i] = el;
              }}
              className="line-pop"
            />
          ))}
        </div>
      </div>

      <dl className="line-counts">
        <div>
          <dt>Shipped clean</dt>
          <dd key={counts.shipped} data-bump={counts.shipped > 0 ? "" : undefined}>
            {counts.shipped}
          </dd>
        </div>
        <div>
          <dt>Caught and fixed</dt>
          <dd key={counts.caught} data-bump={counts.caught > 0 ? "" : undefined}>
            {counts.caught}
          </dd>
        </div>
        <div data-bad={counts.leaked > 0 ? "" : undefined}>
          <dt>Bad ones shipped</dt>
          <dd key={counts.leaked} data-bump={counts.leaked > 0 ? "" : undefined}>
            {counts.leaked}
          </dd>
        </div>
        <div>
          <dt>Restarts</dt>
          <dd key={counts.restarts} data-bump={counts.restarts > 0 ? "" : undefined}>
            {counts.restarts}
          </dd>
        </div>
      </dl>

      <div className="line-controls">
        {!running && (
          <button type="button" className="btn btn-solid" onClick={() => setStarted(true)}>
            Run the line
          </button>
        )}
        <button type="button" className="btn btn-solid" onClick={sendBad}>
          Send a bad task
        </button>
        <button type="button" className="btn btn-glass" aria-pressed={!checker} onClick={() => setChecker((v) => !v)}>
          {checker ? "Switch the checker off" : "Switch the checker on"}
        </button>
        <button
          type="button"
          className="btn btn-glass"
          disabled={stalled}
          onClick={() => {
            setStalled(true);
            setNote("The writer has stalled. Tasks are backing up behind it.");
          }}
        >
          {stalled ? "Writer stalled" : "Stall the writer"}
        </button>
      </div>
    </div>
  );
}
