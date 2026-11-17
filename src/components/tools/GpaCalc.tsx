"use client";

import { useState } from "react";

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
const fix = (n: number, d = 2) => n.toFixed(d);

function Field({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="field-row">
      <span>{label}</span>
      <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={hint} autoComplete="off" />
    </label>
  );
}

export function GpaCalc() {
  const [mode, setMode] = useState<"term" | "final">("term");
  const [gpa, setGpa] = useState("3.4");
  const [done, setDone] = useState("60");
  const [term, setTerm] = useState("15");
  const [goal, setGoal] = useState("3.45");
  const [grade, setGrade] = useState("86");
  const [weight, setWeight] = useState("25");
  const [want, setWant] = useState("87");

  let big = "";
  let line = "Fill in the numbers above.";
  let tone: "ok" | "hard" | "no" | "" = "";

  if (mode === "term") {
    const g = num(gpa);
    const c1 = num(done);
    const c2 = num(term);
    const t = num(goal);
    if ([g, c1, c2, t].every(Number.isFinite) && g >= 0 && g <= 4.3 && t >= 0 && t <= 4.3 && c1 >= 0 && c2 > 0) {
      const need = (t * (c1 + c2) - g * c1) / c2;
      const best = (g * c1 + 4 * c2) / (c1 + c2);
      if (need > 4) {
        big = fix(best);
        tone = "no";
        // How many more credits of straight A's it would take to get there at all.
        const more = t < 4 ? Math.ceil(((t - g) * c1) / (4 - t)) : Infinity;
        line = `Not this term. Straight A's would bring you to ${fix(best)}.${Number.isFinite(more) ? ` You would need about ${more} credits of A's to reach ${fix(t)}.` : ""}`;
      } else if (need <= 0) {
        big = "0.00";
        tone = "ok";
        line = `You are already past ${fix(t)}. Nothing you do this term can take you under it.`;
      } else {
        big = fix(need);
        tone = need > 3.7 ? "hard" : "ok";
        line = `Average a ${fix(need)} across ${c2} credits this term and you finish at ${fix(t)}.${need > 3.7 ? " That is nearly all A's." : ""}`;
      }
    }
  } else {
    const cur = num(grade);
    const w = num(weight) / 100;
    const t = num(want);
    if ([cur, w, t].every(Number.isFinite) && w > 0 && w < 1 && cur >= 0 && t >= 0) {
      const need = (t - cur * (1 - w)) / w;
      const best = cur * (1 - w) + 100 * w;
      if (need > 100) {
        big = `${fix(best, 1)}%`;
        tone = "no";
        line = `Out of reach. You would need ${fix(need, 1)}% on the final. A perfect score gets you ${fix(best, 1)}%.`;
      } else if (need <= 0) {
        big = "0%";
        tone = "ok";
        line = `You have ${fix(t, 0)}% locked in, even with a zero on the final.`;
      } else {
        big = `${fix(need, 1)}%`;
        tone = need > 92 ? "hard" : "ok";
        line = `Score ${fix(need, 1)}% on the final to finish the class with ${fix(t, 0)}%.`;
      }
    }
  }

  return (
    <div className="tool gpa">
      <fieldset className="seg" aria-label="What to work out">
        <label className="seg-item">
          <input type="radio" name="gpa-mode" checked={mode === "term"} onChange={() => setMode("term")} />
          <span>The GPA I need this term</span>
        </label>
        <label className="seg-item">
          <input type="radio" name="gpa-mode" checked={mode === "final"} onChange={() => setMode("final")} />
          <span>The grade I need on the final</span>
        </label>
      </fieldset>

      <div className="gpa-grid">
        {mode === "term" ? (
          <div className="gpa-fields">
            <Field label="GPA so far" value={gpa} onChange={setGpa} />
            <Field label="Credits finished" value={done} onChange={setDone} />
            <Field label="Credits this term" value={term} onChange={setTerm} />
            <Field label="GPA you want" value={goal} onChange={setGoal} />
          </div>
        ) : (
          <div className="gpa-fields">
            <Field label="Grade so far, %" value={grade} onChange={setGrade} />
            <Field label="Final is worth, %" value={weight} onChange={setWeight} />
            <Field label="Grade you want, %" value={want} onChange={setWant} />
          </div>
        )}
        <div className="gpa-answer" data-tone={tone || undefined} role="status">
          <p className="meta">{mode === "term" ? (tone === "no" ? "Best you can reach" : "You need") : tone === "no" ? "Best you can finish with" : "You need"}</p>
          <p className="gpa-big">{big || "?"}</p>
          <p>{line}</p>
        </div>
      </div>
      <p className="tool-note">Uses a 4.0 scale where an A is 4.0. Nothing you type is saved.</p>
    </div>
  );
}
