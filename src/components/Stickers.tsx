"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Glass } from "@/components/Glass";
import { stickerStore, toLocal, type Place } from "@/lib/stickerStore";

const PAPER = "#fbf6ea";
const INK = "#10212e";

type Sticker = { id: string; label: string; art: ReactNode };

/* Each sticker is drawn here, in a 100 by 100 box, with its own die-cut edge. */
const STICKERS: Sticker[] = [
  {
    id: "aim",
    label: "Shooters",
    art: (
      <>
        <circle cx="50" cy="50" r="40" fill="#ff6b5e" stroke={PAPER} strokeWidth="8" />
        <circle cx="50" cy="50" r="21" fill="none" stroke={INK} strokeWidth="5" />
        <path d="M50 15v17M50 68v17M15 50h17M68 50h17" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        <circle cx="50" cy="50" r="4.5" fill={INK} />
      </>
    ),
  },
  {
    id: "gg",
    label: "Good games",
    art: (
      <>
        <path
          d="M16 20h68a9 9 0 0 1 9 9v32a9 9 0 0 1-9 9H47L30 87V70H16a9 9 0 0 1-9-9V29a9 9 0 0 1 9-9Z"
          fill="#7a4bd6"
          stroke={PAPER}
          strokeWidth="8"
          strokeLinejoin="round"
        />
        <text x="50" y="59" textAnchor="middle" fontSize="42" fill={PAPER} style={{ fontFamily: "var(--font-pixel)" }}>
          GG
        </text>
      </>
    ),
  },
  {
    id: "tea",
    label: "Tea",
    art: (
      <>
        <rect x="10" y="10" width="80" height="80" rx="23" fill="#2f8f6b" stroke={PAPER} strokeWidth="8" />
        <path d="M41 31q-4-5 0-10M57 31q4-5 0-10" fill="none" stroke={PAPER} strokeWidth="3.5" strokeLinecap="round" opacity="0.85" />
        <circle cx="50" cy="38.5" r="3.8" fill="#ffe7a8" />
        <path d="M27 49q23-13 46 0Z" fill="#ffe7a8" />
        <path d="M30 52h40c0 15-8 23-20 23s-20-8-20-23Z" fill={PAPER} />
        <path d="M33 80h34" stroke={PAPER} strokeWidth="4" strokeLinecap="round" />
      </>
    ),
  },
  {
    id: "pickle",
    label: "Pickleball",
    art: (
      <>
        <g transform="rotate(24 47 42)">
          <path
            d="M30 8h34a12 12 0 0 1 12 12v28a12 12 0 0 1-12 12H56v24a6 6 0 0 1-6 6h-6a6 6 0 0 1-6-6V60h-8a12 12 0 0 1-12-12V20A12 12 0 0 1 30 8Z"
            fill="#ffc94d"
            stroke={PAPER}
            strokeWidth="8"
            strokeLinejoin="round"
          />
          <rect x="38" y="62" width="18" height="24" rx="5" fill={INK} />
        </g>
        <circle cx="80" cy="76" r="13" fill="#d7f25a" stroke={PAPER} strokeWidth="6" />
        <g fill={INK} opacity="0.7">
          <circle cx="76" cy="72" r="2" />
          <circle cx="84" cy="73" r="2" />
          <circle cx="78" cy="80" r="2" />
          <circle cx="86" cy="81" r="2" />
        </g>
      </>
    ),
  },
  {
    id: "points",
    label: "Credit card points",
    art: (
      <g transform="rotate(-9 50 50)">
        <rect x="9" y="23" width="82" height="54" rx="10" fill="#17324d" stroke={PAPER} strokeWidth="8" />
        <rect x="13" y="35" width="74" height="10" fill="#0a1826" />
        <rect x="18" y="54" width="17" height="13" rx="3.5" fill="#ffc94d" />
        <path d="M70 49l3.2 7.3 7.3 3.2-7.3 3.2L70 70l-3.2-7.3-7.3-3.2 7.3-3.2Z" fill="#ffc94d" />
        <path d="M84 50l1.4 3.1 3.1 1.4-3.1 1.4L84 59l-1.4-3.1-3.1-1.4 3.1-1.4Z" fill={PAPER} />
      </g>
    ),
  },
  {
    id: "wok",
    label: "Cooking",
    art: (
      <>
        <circle cx="50" cy="50" r="40" fill="#ff9d3c" stroke={PAPER} strokeWidth="8" />
        <path d="M37 41q-5-7 0-14M50 39q-5-7 0-14M63 41q-5-7 0-14" fill="none" stroke={PAPER} strokeWidth="3.8" strokeLinecap="round" />
        <path d="M76 55l15-7" stroke={PAPER} strokeWidth="13" strokeLinecap="round" />
        <path d="M76 55l15-7" stroke={INK} strokeWidth="6" strokeLinecap="round" />
        <path d="M21 50h58c0 16-13 25-29 25S21 66 21 50Z" fill={INK} />
      </>
    ),
  },
  {
    id: "la",
    label: "Los Angeles",
    art: (
      <>
        <circle cx="50" cy="50" r="40" fill="#ff6b8a" stroke={PAPER} strokeWidth="8" />
        <circle cx="56" cy="60" r="17" fill="#ffc94d" />
        <path d="M15.4 70a40 40 0 0 0 69.2 0Z" fill="#5a2a6e" />
        <path d="M40 84q1-22 8-36" fill="none" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
        <path
          d="M48 48q-12-9-23-1M48 48q-6-15-19-13M48 48q4-15 17-13M48 48q13-6 21 4M48 48q11 3 12 14"
          fill="none"
          stroke={INK}
          strokeWidth="4.5"
          strokeLinecap="round"
        />
      </>
    ),
  },
  {
    id: "agent",
    label: "AI agents",
    art: (
      <>
        <rect x="10" y="10" width="80" height="80" rx="23" fill="#1b4bd6" stroke={PAPER} strokeWidth="8" />
        <path d="M30 35 50 66 70 35Z" fill="none" stroke={PAPER} strokeWidth="4" strokeLinejoin="round" />
        <circle cx="30" cy="35" r="8" fill={PAPER} />
        <circle cx="70" cy="35" r="8" fill={PAPER} />
        <circle cx="50" cy="66" r="11" fill="#ffc94d" />
        <path d="M44.5 66.5l4 4 7-8.5" fill="none" stroke={INK} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    id: "ship",
    label: "Shipping product",
    art: (
      <>
        <rect x="6" y="29" width="88" height="42" rx="21" fill={INK} stroke={PAPER} strokeWidth="8" />
        <text
          x="50"
          y="56.5"
          textAnchor="middle"
          fontSize="16.5"
          fill="#ffc94d"
          style={{ fontFamily: "var(--font-archivo), sans-serif", fontStretch: "125%", fontWeight: 800 }}
        >
          SHIP IT
        </text>
      </>
    ),
  },
];

type Drag = { id: string; x: number; y: number; tilt: number };

/** A resting angle that looks hand-placed but is the same every time for the same spot. */
function restingAngle(x: number, y: number) {
  return ((Math.abs(Math.round(x) * 7 + Math.round(y) * 13) % 23) - 11) * 0.9;
}

/**
 * A sheet of stickers under the hero. Each one can be peeled off and stuck
 * anywhere on the page, or onto the badge, where it rides along and is still
 * there on the next visit.
 */
export function Stickers() {
  const { places, badge, placed } = useSyncExternalStore(stickerStore.subscribe, stickerStore.get, stickerStore.getServer);
  const [drag, setDrag] = useState<Drag | null>(null);
  const grip = useRef({ offX: 0, offY: 0, lastX: 0, tilt: 0 });
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragging = drag !== null;
  const dragId = drag?.id ?? null;

  useEffect(() => {
    if (!dragId) return;
    const centre = (e: PointerEvent) => ({ cx: e.clientX - grip.current.offX, cy: e.clientY - grip.current.offY });

    const move = (e: PointerEvent) => {
      const { cx, cy } = centre(e);
      // The sticker leans into the direction it is being carried.
      const g = grip.current;
      g.tilt += ((e.clientX - g.lastX) * 1.6 - g.tilt) * 0.35;
      g.tilt = Math.max(-18, Math.min(18, g.tilt));
      g.lastX = e.clientX;
      setDrag({ id: dragId, x: cx + window.scrollX, y: cy + window.scrollY, tilt: g.tilt });
    };

    const drop = (e: PointerEvent) => {
      const { cx, cy } = centre(e);
      let place: Place = { host: "page", x: cx + window.scrollX, y: cy + window.scrollY, r: restingAngle(cx, cy) };
      const sheet = sheetRef.current?.getBoundingClientRect();
      if (sheet && cx > sheet.left && cx < sheet.right && cy > sheet.top && cy < sheet.bottom) {
        place = { host: "sheet" };
      } else if (badge) {
        const local = toLocal(badge, cx, cy);
        const w = badge.offsetWidth;
        const h = badge.offsetHeight;
        if (local.x > -6 && local.x < w + 6 && local.y > -6 && local.y < h + 6) {
          place = { host: "badge", x: local.x / w, y: local.y / h, r: restingAngle(local.x, local.y) };
        }
      }
      stickerStore.put(dragId, place);
      setDrag(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", drop);
    window.addEventListener("pointercancel", drop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", drop);
      window.removeEventListener("pointercancel", drop);
    };
  }, [dragId, badge]);

  const lift = (id: string) => (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    grip.current = { offX: e.clientX - cx, offY: e.clientY - cy, lastX: e.clientX, tilt: 0 };
    setDrag({ id, x: cx + window.scrollX, y: cy + window.scrollY, tilt: 0 });
  };

  const draw = (s: Sticker, style?: CSSProperties, state?: "lifted" | "placed") => (
    <span
      key={s.id}
      className="sticker"
      data-lifted={state === "lifted" ? "" : undefined}
      data-placed={state === "placed" ? "" : undefined}
      style={style}
      onPointerDown={lift(s.id)}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" focusable="false">
        {s.art}
      </svg>
    </span>
  );

  const where = (s: Sticker): Place => (dragId === s.id ? { host: "sheet" } : (places[s.id] ?? { host: "sheet" }));
  const onPage = STICKERS.filter((s) => where(s).host === "page");
  const onBadge = STICKERS.filter((s) => where(s).host === "badge");
  const carried = STICKERS.find((s) => s.id === dragId);
  const anyOff = STICKERS.some((s) => (places[s.id]?.host ?? "sheet") !== "sheet");

  return (
    <div className="wrap">
      <Glass kind="card" className="stickers">
        <div ref={sheetRef} className="stickers-sheet">
          <div className="stickers-note">
            <p className="note">peel one. stick it anywhere, even on my badge.</p>
            {anyOff && (
              <button type="button" className="text-link stickers-reset" onClick={() => stickerStore.reset()}>
                Put them back
              </button>
            )}
          </div>
          <ul className="sticker-slots" aria-label="Things I’m into">
            {STICKERS.map((s) => {
              const home = dragId !== s.id && where(s).host === "sheet";
              return (
                <li key={s.id} data-empty={home ? undefined : ""}>
                  <span className="sr-only">{s.label}</span>
                  {home && draw(s)}
                </li>
              );
            })}
          </ul>
        </div>
      </Glass>

      {(onPage.length > 0 || dragging) &&
        createPortal(
          <div className="sticker-layer">
            {onPage.map((s) => {
              const p = where(s) as Extract<Place, { host: "page" }>;
              return draw(s, { left: p.x, top: p.y, rotate: `${p.r}deg` }, placed === s.id ? "placed" : undefined);
            })}
            {carried && drag && draw(carried, { left: drag.x, top: drag.y, rotate: `${drag.tilt}deg` }, "lifted")}
          </div>,
          document.body,
        )}

      {badge &&
        onBadge.length > 0 &&
        createPortal(
          <>
            {onBadge.map((s) => {
              const p = where(s) as Extract<Place, { host: "badge" }>;
              return draw(
                s,
                { left: `${p.x * 100}%`, top: `${p.y * 100}%`, rotate: `${p.r}deg` },
                placed === s.id ? "placed" : undefined,
              );
            })}
          </>,
          badge,
        )}
    </div>
  );
}
