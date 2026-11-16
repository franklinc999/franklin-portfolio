/**
 * Where each sticker currently is. A sticker starts on the sheet, can be
 * stuck anywhere on the page, or stuck onto the badge, where it stays put
 * between visits.
 */
export type Place =
  | { host: "sheet" }
  /** Centre, in document px. */
  | { host: "page"; x: number; y: number; r: number }
  /** Centre, as a share of the badge's width and height. */
  | { host: "badge"; x: number; y: number; r: number };

export type StickerState = {
  places: Record<string, Place>;
  /** The badge card, once it has mounted. */
  badge: HTMLElement | null;
  /** The sticker most recently put down, so it can be pressed into place. */
  placed: string | null;
};

const KEY = "badge-stickers";
const EMPTY: StickerState = { places: {}, badge: null, placed: null };

let state: StickerState = EMPTY;
let loaded = false;
const subs = new Set<() => void>();

function emit() {
  for (const cb of subs) cb();
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return;
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return;
    const places: Record<string, Place> = {};
    for (const [id, value] of Object.entries(saved as Record<string, unknown>)) {
      const p = value as { x?: unknown; y?: unknown; r?: unknown } | null;
      if (p && typeof p.x === "number" && typeof p.y === "number") {
        places[id] = { host: "badge", x: p.x, y: p.y, r: typeof p.r === "number" ? p.r : 0 };
      }
    }
    state = { ...state, places };
  } catch {
    // Unreadable or unavailable storage just means a clean badge.
  }
}

function save() {
  try {
    const onBadge: Record<string, { x: number; y: number; r: number }> = {};
    for (const [id, place] of Object.entries(state.places)) {
      if (place.host === "badge") onBadge[id] = { x: place.x, y: place.y, r: place.r };
    }
    window.localStorage.setItem(KEY, JSON.stringify(onBadge));
  } catch {
    // Not remembered, which is fine.
  }
}

export const stickerStore = {
  subscribe(cb: () => void) {
    subs.add(cb);
    return () => {
      subs.delete(cb);
    };
  },
  get(): StickerState {
    load();
    return state;
  },
  getServer(): StickerState {
    return EMPTY;
  },
  put(id: string, place: Place) {
    state = { ...state, places: { ...state.places, [id]: place }, placed: place.host === "sheet" ? null : id };
    save();
    emit();
  },
  reset() {
    state = { ...state, places: {}, placed: null };
    save();
    emit();
  },
  setBadge(el: HTMLElement | null) {
    if (state.badge === el) return;
    state = { ...state, badge: el };
    emit();
  },
};

/**
 * A point on screen, expressed in an element's own untransformed box. Works
 * for any 2D transform on the element itself, which is all the badge has.
 */
export function toLocal(el: HTMLElement, clientX: number, clientY: number) {
  const cs = getComputedStyle(el);
  const matrix = new DOMMatrixReadOnly(cs.transform === "none" ? undefined : cs.transform);
  const [ox, oy] = cs.transformOrigin.split(" ").map((v) => parseFloat(v) || 0);
  const parent = el.offsetParent instanceof HTMLElement ? el.offsetParent : document.body;
  const pr = parent.getBoundingClientRect();
  const left = pr.left + parent.clientLeft + el.offsetLeft;
  const top = pr.top + parent.clientTop + el.offsetTop;
  const p = new DOMPoint(clientX - left - ox, clientY - top - oy).matrixTransform(matrix.inverse());
  return { x: p.x + ox, y: p.y + oy };
}
