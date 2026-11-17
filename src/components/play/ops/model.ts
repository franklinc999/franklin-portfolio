/**
 * Live Ops: the rules of the season, with nothing about how it is drawn.
 *
 * Everything here is invented for the game: the title you run, the cards, the events and the numbers.
 * The model is pure (state in, state out) so the balance can be simulated outside the browser.
 */

export type Meters = {
  /** Weekly active players. */
  players: number;
  /** How the community feels, 0 to 100. */
  mood: number;
  /** How well the game holds together, 0 to 100. */
  stability: number;
  /** How much the team has left, 0 to 100. */
  energy: number;
  /** Season revenue so far, in thousands. */
  revenue: number;
};

export type Kind = "content" | "store" | "health" | "community";

export type Card = {
  id: string;
  name: string;
  kind: Kind;
  cost: 1 | 2 | 3;
  line: string;
  /** Percent change to players. */
  players?: number;
  mood?: number;
  stability?: number;
  energy?: number;
  /** Thousands, before the size of the audience and its mood scale it. */
  revenue?: number;
  /** Ships once a season. */
  once?: boolean;
};

export const CARDS: Card[] = [
  { id: "island", name: "New island: Driftwood Cove", kind: "content", cost: 3, line: "The big drop. Everyone comes back to look.", players: 13, mood: 5, stability: -12, energy: -12, once: true },
  { id: "kites", name: "Kite racing, two weeks only", kind: "content", cost: 2, line: "A limited mode. Fun, and a little rushed.", players: 8, mood: 3, stability: -7, energy: -7, once: true },
  { id: "festival", name: "Lantern festival", kind: "content", cost: 2, line: "A community event with a shared goal.", players: 6, mood: 6, stability: -2, energy: -6, once: true },
  { id: "market", name: "The night market returns", kind: "content", cost: 1, line: "An old favourite, dusted off.", players: 4, mood: 2, stability: -2, energy: -2, once: true },
  { id: "photo", name: "Photo mode", kind: "content", cost: 2, line: "Players asked for it for a year.", players: 3, mood: 7, stability: -4, energy: -5, once: true },
  { id: "bundle", name: "Weekend bundle", kind: "store", cost: 1, line: "Quick money. People notice when it is every week.", revenue: 26, mood: -4 },
  { id: "outfits", name: "Festival outfits", kind: "store", cost: 2, line: "Sells best the week there is something new to wear it to.", revenue: 44, mood: -3 },
  { id: "pass", name: "Season pass, second track", kind: "store", cost: 2, line: "The biggest number on the board, and the loudest thread.", revenue: 70, mood: -9, once: true },
  { id: "gift", name: "A gift in every mailbox", kind: "community", cost: 1, line: "Costs a little. Buys a lot of goodwill.", mood: 5, players: 1 },
  { id: "notes", name: "Patch notes that say why", kind: "community", cost: 1, line: "Explain the change, not just the change.", mood: 4 },
  { id: "forums", name: "Read the forums", kind: "community", cost: 1, line: "Shows you what is coming this week before you commit.", mood: 1 },
  { id: "bugs", name: "Fix the ten most reported bugs", kind: "health", cost: 2, line: "Nobody posts a trailer for it. Everybody feels it.", stability: 16, mood: 3 },
  { id: "servers", name: "Server headroom", kind: "health", cost: 1, line: "Boring until the Saturday you need it.", stability: 9 },
  { id: "friday", name: "Quiet Friday", kind: "health", cost: 1, line: "Ship nothing. Send people home early.", energy: 16 },
];

export type EventId = "streamer" | "dupe" | "rival" | "fanart" | "holiday" | "quiet" | "sick" | "praise";

export const EVENTS: Record<EventId, { name: string; hint: string }> = {
  streamer: { name: "A big streamer spends the weekend in your game", hint: "Bigger if there is something new to show." },
  dupe: { name: "Someone finds a duplication bug in the trading post", hint: "Hurts unless the game is stable or a fix is going out." },
  rival: { name: "A rival cozy game launches on Thursday", hint: "Players drift unless you give them a reason to stay." },
  fanart: { name: "A fan art contest takes off on its own", hint: "A free good week." },
  holiday: { name: "School holidays start", hint: "More people with time to play." },
  quiet: { name: "A quiet week", hint: "Nothing from outside." },
  sick: { name: "Half the team is out sick", hint: "The team has less in the tank." },
  praise: { name: "A writer covers how the studio talks to players", hint: "Kind if you have been explaining yourself." },
};

export type Step = { label: string; detail?: string; delta: Partial<Meters>; tone: "good" | "bad" | "flat" };

export type State = {
  week: number;
  weeks: number;
  meters: Meters;
  /** Where the meters stood at the end of each week. Index 0 is the start of the season. */
  history: Meters[];
  hand: Card[];
  used: string[];
  event: EventId;
  revealed: boolean;
  sinceContent: number;
  storeStreak: number;
  seed: number;
  done: boolean;
  /** What you shipped, week by week. */
  shipped: string[][];
};

export const WEEKS = 8;
const START: Meters = { players: 120_000, mood: 62, stability: 68, energy: 78, revenue: 0 };

/** A small seeded generator, so a season can be replayed and tested. */
function next(seed: number) {
  let t = (seed + 0x6d2b79f5) | 0;
  const s = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: s };
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

function rollEvent(state: Pick<State, "meters" | "week">, seed: number): { event: EventId; seed: number } {
  const m = state.meters;
  const table: [EventId, number][] = [
    ["quiet", 3],
    ["streamer", 2],
    ["rival", state.week > 1 ? 2 : 0],
    ["fanart", m.mood > 55 ? 2 : 0.5],
    ["holiday", 1.2],
    ["sick", 1.2],
    ["praise", 1.2],
    ["dupe", m.stability < 62 ? 3 : 1],
  ];
  const total = table.reduce((a, [, w]) => a + w, 0);
  const r = next(seed);
  let at = r.value * total;
  for (const [id, w] of table) {
    at -= w;
    if (at <= 0) return { event: id, seed: r.seed };
  }
  return { event: "quiet", seed: r.seed };
}

function deal(used: string[], seed: number): { hand: Card[]; seed: number } {
  const pool = CARDS.filter((c) => !used.includes(c.id));
  const pick = (from: Card[]) => {
    const r = next(seed);
    seed = r.seed;
    return from[Math.floor(r.value * from.length)];
  };
  const hand: Card[] = [];
  // One of each kind where there is one left, so no week is a dead hand.
  for (const kind of ["content", "store", "health", "community"] as Kind[]) {
    const of = pool.filter((c) => c.kind === kind && !hand.includes(c));
    if (of.length) hand.push(pick(of));
  }
  while (hand.length < 6) {
    const rest = pool.filter((c) => !hand.includes(c));
    if (!rest.length) break;
    hand.push(pick(rest));
  }
  return { hand, seed };
}

export function newSeason(seed: number): State {
  const first = rollEvent({ meters: START, week: 1 }, seed);
  const dealt = deal([], first.seed);
  return {
    week: 1,
    weeks: WEEKS,
    meters: { ...START },
    history: [{ ...START }],
    hand: dealt.hand,
    used: [],
    event: first.event,
    revealed: false,
    sinceContent: 0,
    storeStreak: 0,
    seed: dealt.seed,
    done: false,
    shipped: [],
  };
}

/** How many points of work the team can take on this week. A rested team does more; a tired one does less. */
export function capacity(state: State) {
  const e = state.meters.energy;
  return e < 35 ? 2 : e >= 75 ? 4 : 3;
}

/** What one card does this week, given what else is going out with it. */
export function cardEffect(card: Card, picks: Card[], m: Meters): Partial<Meters> {
  const out: Partial<Meters> = {};
  if (card.players) out.players = Math.round((m.players * card.players) / 100);
  if (card.mood) out.mood = card.mood;
  if (card.stability) out.stability = card.stability;
  if (card.energy) out.energy = card.energy;
  if (card.revenue) {
    // A store beat earns with the size of the audience and with how it feels about you.
    let earn = card.revenue * (m.players / 120_000) * (0.55 + m.mood / 140);
    if (card.id === "outfits" && picks.some((p) => p.kind === "content")) {
      earn *= 1.5;
      out.mood = (out.mood ?? 0) + 2;
    }
    out.revenue = Math.round(earn);
  }
  return out;
}

/** Add a change to the meters, keeping each inside its range. */
export function applyDelta(m: Meters, d: Partial<Meters>): Meters {
  return {
    players: Math.max(0, Math.round(m.players + (d.players ?? 0))),
    mood: clamp(m.mood + (d.mood ?? 0)),
    stability: clamp(m.stability + (d.stability ?? 0)),
    energy: clamp(m.energy + (d.energy ?? 0)),
    revenue: Math.round(m.revenue + (d.revenue ?? 0)),
  };
}

const tone = (d: Partial<Meters>): Step["tone"] => {
  const v = (d.players ?? 0) / 2000 + (d.mood ?? 0) + (d.stability ?? 0) / 2 + (d.energy ?? 0) / 2 + (d.revenue ?? 0) / 8;
  return v > 0.5 ? "good" : v < -0.5 ? "bad" : "flat";
};

/** Ship the week: cards first, then the world answers. Returns the new state and what happened, in order. */
export function shipWeek(state: State, picks: Card[]): { state: State; steps: Step[] } {
  const steps: Step[] = [];
  let m = { ...state.meters };
  let seed = state.seed;
  const add = (label: string, delta: Partial<Meters>, detail?: string) => {
    m = applyDelta(m, delta);
    steps.push({ label, detail, delta, tone: tone(delta) });
  };

  const spent = picks.reduce((a, c) => a + c.cost, 0);
  const cap = capacity(state);
  const content = picks.filter((c) => c.kind === "content");
  const stores = picks.filter((c) => c.kind === "store");
  const fix = picks.some((c) => c.id === "bugs");
  const talked = picks.some((c) => c.id === "notes" || c.id === "forums");

  for (const card of picks) add(card.name, cardEffect(card, picks, m));

  // The week itself.
  const base = Math.round((m.players / 1000) * 0.3 * (0.6 + m.mood / 160));
  add("A normal week of play", { revenue: base, stability: -3 }, "People who are here and happy spend a little. A live game also frays a little every week it runs.");

  if (stores.length >= 2) add("The store feels pushy", { mood: -8 }, "Two offers in one week reads as a sale, not a season.");
  const storeStreak = stores.length ? state.storeStreak + 1 : 0;
  if (stores.length === 1 && storeStreak >= 3) add("Another week, another offer", { mood: -5 }, "Three weeks of selling in a row. The thread about it has a name now.");

  const sinceContent = content.length ? 0 : state.sinceContent + 1;
  if (!content.length) {
    const drift = sinceContent >= 2 ? -9 : -5;
    add(
      sinceContent >= 2 ? "Nothing new for a while" : "Nothing new this week",
      { players: Math.round((m.players * drift) / 100), mood: sinceContent >= 2 ? -3 : 0 },
      sinceContent >= 2 ? "People finish what there is and wander off." : "A few players drift, as they always do.",
    );
  }

  const slack = cap - spent;
  if (slack > 0) add("The team had room to breathe", { energy: slack * 5 });
  else add("A full week", { energy: -5 });

  // The world answers.
  const e = state.event;
  if (e === "streamer") add(EVENTS[e].name, { players: Math.round(m.players * (content.length ? 0.13 : 0.06)), mood: 2 }, content.length ? "And there was something new to show them." : "They played the old stuff and left.");
  if (e === "dupe") {
    if (fix) add(EVENTS[e].name, { mood: 4 }, "The fix was already going out. You look like you saw it coming.");
    else if (m.stability >= 70) add(EVENTS[e].name, { mood: -2 }, "It is small and patched by Monday.");
    else add(EVENTS[e].name, { mood: -9, players: Math.round(m.players * -0.04), stability: -6 }, "The economy is a mess for a week.");
  }
  if (e === "rival") add(EVENTS[e].name, { players: Math.round(m.players * (content.length ? -0.02 : -0.09)) }, content.length ? "Yours had something new the same week. Most people stayed." : "You had nothing new to answer with.");
  if (e === "fanart") add(EVENTS[e].name, { mood: 6, players: Math.round(m.players * 0.03) });
  if (e === "holiday") add(EVENTS[e].name, { players: Math.round(m.players * 0.06) });
  if (e === "sick") add(EVENTS[e].name, { energy: -12 });
  if (e === "praise") add(EVENTS[e].name, talked ? { mood: 7, players: Math.round(m.players * 0.02) } : { mood: 1 }, talked ? "You explained yourself this week, and it got quoted." : "There was not much from this week to quote.");
  if (e === "quiet") add(EVENTS[e].name, {});

  // Things that follow from the state of the game rather than from any one choice.
  const outage = next(seed);
  seed = outage.seed;
  if (outage.value < Math.max(0, 56 - m.stability) / 45) {
    add("The servers fall over on Saturday night", { players: Math.round(m.players * -0.07), mood: -10 }, "Stability was low, and the busiest night found it.");
  }
  const feel = (m.mood - 55) / 100;
  if (Math.abs(feel) > 0.08) {
    add(feel > 0 ? "Word of mouth is good" : "Word of mouth is bad", { players: Math.round(m.players * feel * 0.07) }, feel > 0 ? "Happy players bring friends." : "Unhappy players tell theirs.");
  }
  if (m.energy < 30) add("People are making tired mistakes", { stability: -8 }, "A burnt out team ships bugs.");
  // Goodwill is not a bank balance. It fades toward the middle unless you keep earning it.
  const fade = Math.round((52 - m.mood) * 0.15);
  if (Math.abs(fade) >= 2) add(fade < 0 ? "Last week's goodwill fades" : "People cool off", { mood: fade });

  const used = [...state.used, ...picks.filter((c) => c.once).map((c) => c.id)];
  const week = state.week + 1;
  const done = week > state.weeks;
  const rolled = rollEvent({ meters: m, week }, seed);
  const dealt = deal(used, rolled.seed);

  return {
    steps,
    state: {
      ...state,
      week: done ? state.weeks : week,
      meters: m,
      history: [...state.history, { ...m }],
      hand: done ? [] : dealt.hand,
      used,
      event: rolled.event,
      revealed: false,
      sinceContent,
      storeStreak,
      seed: dealt.seed,
      done,
      shipped: [...state.shipped, picks.map((c) => c.id)],
    },
  };
}

export type Review = { score: number; grade: "S" | "A" | "B" | "C" | "D"; headline: string; notes: string[] };

/** The season review: one number, and the trade-offs behind it in plain words. */
export function review(state: State): Review {
  const m = state.meters;
  const growth = m.players / START.players;
  const score = Math.round(growth * 300 + m.revenue * 0.7 + m.mood * 2.4 + m.energy * 1.3 + m.stability * 0.8);
  // Thresholds come from simulating a few hundred seasons: picking at random lands around a C,
  // steady sensible play around a B, and planning a week ahead around an A.
  const grade = score >= 1130 ? "S" : score >= 1000 ? "A" : score >= 880 ? "B" : score >= 760 ? "C" : "D";

  const notes: string[] = [];
  notes.push(
    growth >= 1.25
      ? `The audience grew by ${Math.round((growth - 1) * 100)}%. New things kept landing before people got bored.`
      : growth >= 1.08
        ? `The audience grew by ${Math.round((growth - 1) * 100)}%. Steady, with a few weeks that gave some of it back.`
        : growth >= 0.95
          ? "You ended with about as many players as you started with. The season held, and did not grow."
          : `You lost ${Math.round((1 - growth) * 100)}% of the audience. There were too many weeks with nothing new.`,
  );
  notes.push(
    m.mood >= 70
      ? "Players trust you. That is the thing next season gets to spend."
      : m.mood >= 48
        ? "The community is fine with you. Not angry, not in love."
        : "You made the money and spent trust to do it. Next season starts with an apology.",
  );
  notes.push(
    m.energy >= 60
      ? "The team finishes with something left. That is rarer than a good revenue number."
      : m.energy >= 35
        ? "The team is tired but standing."
        : "The team is cooked. Whatever the numbers say, next season starts in a hole.",
  );
  if (m.stability < 45) notes.push("The game is held together with tape. Every launch from here is a gamble.");

  const headline =
    grade === "S"
      ? "A season people will bring up in a year"
      : grade === "A"
        ? "A good season, and you can run another"
        : grade === "B"
          ? "A fine season with a bill attached"
          : grade === "C"
            ? "It shipped. Something gave."
            : "A hard season";
  return { score, grade, headline, notes };
}
