import type { Meters } from "./model";

/** Where each boat ties up, back row first. More players, more boats. */
const BERTHS = [
  [300, 122], [420, 118], [545, 124], [665, 119], [760, 125],
  [250, 142], [362, 146], [484, 141], [606, 147], [716, 143],
  [305, 160], [545, 162], [430, 163], [665, 164],
];
const HULLS = ["#1d2b4f", "#e2513b", "#2f7d57", "#e9b23c"];

/**
 * The harbor, drawn from the state of the season: boats for players, weather for mood, the lighthouse
 * for stability, lit windows for the team, crates on the dock for revenue.
 */
export function Harbor({ meters }: { meters: Meters }) {
  const boats = Math.max(1, Math.min(BERTHS.length, Math.round(meters.players / 15000)));
  const sky = meters.mood >= 65 ? "#bfe3f2" : meters.mood >= 40 ? "#d5e2e4" : "#98a6b3";
  const weather = meters.mood >= 65 ? "fair" : meters.mood >= 40 ? "overcast" : "raining";
  const light = meters.stability >= 55 ? "steady" : meters.stability >= 30 ? "flickering" : "out";
  const windows = Math.round(meters.energy / 25);
  const crates = Math.min(9, Math.floor(meters.revenue / 60));
  const kites = meters.mood >= 75 ? 3 : meters.mood >= 55 ? 2 : meters.mood >= 45 ? 1 : 0;

  return (
    <svg
      className="hb-harbor"
      viewBox="0 0 800 176"
      role="img"
      aria-label={`The harbor: ${boats} ${boats === 1 ? "boat" : "boats"} in, ${weather}, the lighthouse ${light}, ${windows} of 4 windows lit, ${crates} ${crates === 1 ? "crate" : "crates"} on the dock.`}
      data-weather={weather}
      data-light={light}
    >
      <rect width="800" height="176" fill={sky} className="hb-sky" />
      {meters.mood >= 55 && <circle cx="706" cy="40" r="24" fill="#e9b23c" />}
      {meters.mood < 65 &&
        [[150, 30, 1], [420, 22, 1.2], [640, 36, 0.9]].slice(0, meters.mood < 40 ? 3 : 2).map(([x, y, k]) => (
          <g key={x} transform={`translate(${x} ${y}) scale(${k})`} className="hb-cloud">
            <ellipse cx="0" cy="6" rx="46" ry="12" />
            <circle cx="-18" cy="0" r="14" />
            <circle cx="8" cy="-6" r="18" />
            <circle cx="30" cy="2" r="12" />
          </g>
        ))}
      {Array.from({ length: kites }, (_, i) => (
        <g key={i} transform={`translate(${470 + i * 96} ${52 - (i % 2) * 18})`}>
          {/* The sway is on an inner group, so it does not replace the position. */}
          <g className="hb-kite" style={{ animationDelay: `${i * -1.3}s` }}>
            <path d="M0 -12 L9 0 L0 14 L-9 0 Z" fill={HULLS[(i + 1) % HULLS.length]} stroke="#1d2b4f" strokeWidth="2" />
            <path d="M0 14 q-6 14 4 26 q8 10 -2 22" fill="none" stroke="#1d2b4f" strokeWidth="1.5" />
          </g>
        </g>
      ))}
      <path d="M0 104 Q120 70 250 96 T520 88 T800 98 V110 H0 Z" fill="#7fb59a" />

      <rect y="104" width="800" height="72" fill="#2f8f9d" />
      <g className="hb-waves" fill="none" stroke="#bfe3e6" strokeWidth="2" strokeLinecap="round">
        {[118, 134, 150, 166].map((y, i) => (
          <path key={y} d={Array.from({ length: 12 }, (_, k) => `M${k * 80 - 40 + (i % 2) * 34} ${y} q10 -6 20 0 t20 0`).join(" ")} opacity={0.75 - i * 0.12} />
        ))}
      </g>

      {/* The rock, the lighthouse and its beam. */}
      <path d="M0 112 Q40 84 96 96 Q130 100 140 112 Z" fill="#6b7a70" />
      <g className="hb-lighthouse" transform={light === "out" ? "rotate(-7 66 100)" : undefined}>
        {light !== "out" && <path d="M66 42 L330 8 L330 78 Z" className="hb-beam" />}
        <path d="M52 100 L58 46 H74 L80 100 Z" fill="#fffaf0" stroke="#1d2b4f" strokeWidth="2.5" />
        <path d="M56.5 62 H75.5 L76.8 74 H55.2 Z M54 86 H78 L79 96 H53 Z" fill="#e2513b" />
        <rect x="56" y="34" width="20" height="12" fill={light === "out" ? "#5b6472" : "#ffe9a8"} stroke="#1d2b4f" strokeWidth="2.5" />
        <path d="M53 34 H79 L66 22 Z" fill="#e2513b" stroke="#1d2b4f" strokeWidth="2.5" strokeLinejoin="round" />
        {light === "out" && <path d="M62 52 l5 9 l-4 6 l6 10" fill="none" stroke="#1d2b4f" strokeWidth="2" />}
      </g>

      {/* The dock, the harbor office, and whatever the season has earned. */}
      <rect x="96" y="100" width="150" height="9" fill="#a8774a" stroke="#1d2b4f" strokeWidth="2" />
      {[110, 150, 190, 230].map((x) => (
        <rect key={x} x={x} y="109" width="6" height="22" fill="#7a5433" />
      ))}
      <path d="M132 100 V72 L158 58 L184 72 V100 Z" fill="#fffaf0" stroke="#1d2b4f" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M126 74 L158 56 L190 74" fill="none" stroke="#e2513b" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={139 + (i % 2) * 24} y={76 + Math.floor(i / 2) * 12} width="12" height="8" fill={i < windows ? "#e9b23c" : "#1d2b4f"} stroke="#1d2b4f" strokeWidth="1.5" />
      ))}
      {Array.from({ length: crates }, (_, i) => (
        <rect key={i} x={194 + (i % 3) * 15} y={88 - Math.floor(i / 3) * 12} width="13" height="11" fill="#e9b23c" stroke="#1d2b4f" strokeWidth="2" />
      ))}

      {BERTHS.slice(0, boats).map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <g className="hb-boat" style={{ animationDelay: `${(i * 0.37) % 2.4}s` }}>
            <path d="M0 -4 V-34" stroke="#1d2b4f" strokeWidth="2" />
            <path d="M2 -32 L22 -8 H2 Z" fill="#fffaf0" stroke="#1d2b4f" strokeWidth="2" strokeLinejoin="round" />
            <path d="M-2 -28 L-14 -8 H-2 Z" fill="#fffaf0" stroke="#1d2b4f" strokeWidth="2" strokeLinejoin="round" />
            <path d="M-24 -4 H26 L18 8 H-16 Z" fill={HULLS[i % HULLS.length]} stroke="#1d2b4f" strokeWidth="2" strokeLinejoin="round" />
          </g>
        </g>
      ))}
      {weather === "raining" && (
        <g className="hb-rain" stroke="#e8f1f4" strokeWidth="1.5" strokeLinecap="round" opacity="0.7">
          {Array.from({ length: 46 }, (_, i) => (
            <path key={i} d={`M${(i * 53) % 800} ${(i * 37) % 150} l-5 14`} />
          ))}
        </g>
      )}
    </svg>
  );
}
