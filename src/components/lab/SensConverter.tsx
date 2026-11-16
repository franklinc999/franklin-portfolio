"use client";

import { useState } from "react";

// Degrees turned per mouse count at sensitivity 1, the same constants the
// Range Warmup trainer uses.
const YAW = { Valorant: 0.07, "Call of Duty": 0.0066, Apex: 0.022 } as const;
type Game = keyof typeof YAW;
const GAMES = Object.keys(YAW) as Game[];

const trim = (n: number) => (n >= 10 ? n.toFixed(1) : n >= 1 ? n.toFixed(2) : n.toFixed(3));

/** Carry one game's mouse sensitivity over to the others, by matching cm per full turn. */
export function SensConverter() {
  const [game, setGame] = useState<Game>("Valorant");
  const [dpi, setDpi] = useState("800");
  const [sens, setSens] = useState("0.5");

  const d = parseFloat(dpi);
  const s = parseFloat(sens);
  const valid = d > 0 && s > 0;
  const cm = valid ? (360 * 2.54) / (d * s * YAW[game]) : 0;

  return (
    <div className="sens">
      <div className="sens-inputs">
        <fieldset className="seg" aria-label="Game you play">
          {GAMES.map((g) => (
            <label key={g} className="seg-item">
              <input type="radio" name="sens-game" checked={g === game} onChange={() => setGame(g)} />
              <span>{g}</span>
            </label>
          ))}
        </fieldset>
        <label className="field-row">
          <span>Mouse DPI</span>
          <input inputMode="numeric" value={dpi} onChange={(e) => setDpi(e.target.value)} aria-invalid={!(d > 0)} />
        </label>
        <label className="field-row">
          <span>Sensitivity in {game}</span>
          <input inputMode="decimal" value={sens} onChange={(e) => setSens(e.target.value)} aria-invalid={!(s > 0)} />
        </label>
      </div>
      <dl className="sens-out" aria-live="polite">
        <div className="sens-main">
          <dt>One full turn</dt>
          <dd>{valid ? `${trim(cm)} cm` : "Enter a DPI and sensitivity"}</dd>
        </div>
        {GAMES.filter((g) => g !== game).map((g) => (
          <div key={g}>
            <dt>Same feel in {g}</dt>
            <dd>{valid ? trim((s * YAW[game]) / YAW[g]) : "0"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
