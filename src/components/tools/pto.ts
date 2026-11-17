/**
 * The arithmetic behind the PTO planner: which days of a year are already free, and which working
 * days to take so that the days you spend turn into the most time away.
 */

export type Holiday = { id: string; name: string; on: boolean };

/** US holidays. The first group is what most companies give; the rest vary, so they start unticked. */
export const HOLIDAYS: Holiday[] = [
  { id: "newyear", name: "New Year's Day", on: true },
  { id: "mlk", name: "Martin Luther King Jr. Day", on: true },
  { id: "presidents", name: "Presidents' Day", on: true },
  { id: "memorial", name: "Memorial Day", on: true },
  { id: "juneteenth", name: "Juneteenth", on: true },
  { id: "july4", name: "Independence Day", on: true },
  { id: "labor", name: "Labor Day", on: true },
  { id: "columbus", name: "Indigenous Peoples' Day", on: false },
  { id: "veterans", name: "Veterans Day", on: false },
  { id: "thanksgiving", name: "Thanksgiving", on: true },
  { id: "blackfriday", name: "Day after Thanksgiving", on: true },
  { id: "xmaseve", name: "Christmas Eve", on: false },
  { id: "xmas", name: "Christmas Day", on: true },
  { id: "nye", name: "New Year's Eve", on: false },
];

export type Day = { date: Date; weekend: boolean; holiday: string; past: boolean };
export type Break = { from: number; to: number; take: number[]; length: number };
export type Style = "weekends" | "trips" | "big";

const day = (y: number, m: number, d: number) => new Date(y, m, d);
const nth = (y: number, m: number, weekday: number, n: number) => {
  const first = day(y, m, 1).getDay();
  return day(y, m, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
};
const last = (y: number, m: number, weekday: number) => {
  const end = day(y, m + 1, 0);
  return day(y, m, end.getDate() - ((end.getDay() - weekday + 7) % 7));
};
const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const shift = (d: Date, by: number) => day(d.getFullYear(), d.getMonth(), d.getDate() + by);
const weekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/** The date each ticked holiday is actually taken in a year: a Saturday moves to Friday, a Sunday to Monday. */
export function holidayDates(year: number, picked: Set<string>) {
  const out = new Map<string, string>();
  const observed = (d: Date) => (d.getDay() === 6 ? shift(d, -1) : d.getDay() === 0 ? shift(d, 1) : d);
  const put = (id: string, name: string, d: Date) => {
    if (picked.has(id)) out.set(key(d), name);
  };
  put("newyear", "New Year's Day", observed(day(year, 0, 1)));
  // Next New Year's Day can be observed on the last day of this year.
  const next = observed(day(year + 1, 0, 1));
  if (next.getFullYear() === year) put("newyear", "New Year's Day, observed", next);
  put("mlk", "Martin Luther King Jr. Day", nth(year, 0, 1, 3));
  put("presidents", "Presidents' Day", nth(year, 1, 1, 3));
  put("memorial", "Memorial Day", last(year, 4, 1));
  put("juneteenth", "Juneteenth", observed(day(year, 5, 19)));
  put("july4", "Independence Day", observed(day(year, 6, 4)));
  put("labor", "Labor Day", nth(year, 8, 1, 1));
  put("columbus", "Indigenous Peoples' Day", nth(year, 9, 1, 2));
  put("veterans", "Veterans Day", observed(day(year, 10, 11)));
  const thanks = nth(year, 10, 4, 4);
  put("thanksgiving", "Thanksgiving", thanks);
  put("blackfriday", "Day after Thanksgiving", shift(thanks, 1));
  put("xmas", "Christmas Day", observed(day(year, 11, 25)));
  // An eve steps back to the nearest working day that is not already a holiday.
  const eve = (id: string, name: string, d: Date) => {
    if (!picked.has(id)) return;
    let at = d;
    while (weekend(at) || out.has(key(at))) at = shift(at, -1);
    out.set(key(at), name);
  };
  eve("xmaseve", "Christmas Eve", day(year, 11, 24));
  eve("nye", "New Year's Eve", day(year, 11, 31));
  return out;
}

export function yearDays(year: number, picked: Set<string>, today: Date): Day[] {
  const holidays = holidayDates(year, picked);
  const start = day(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const out: Day[] = [];
  for (let d = day(year, 0, 1); d.getFullYear() === year; d = shift(d, 1)) {
    out.push({ date: d, weekend: weekend(d), holiday: holidays.get(key(d)) ?? "", past: d.getTime() < start });
  }
  return out;
}

/**
 * Choose the breaks. A break is a run of working days you take, plus the weekends and holidays it
 * touches on either side. Among all sets of breaks that fit the budget and do not overlap, this
 * returns the one with the most days away in total.
 */
export function plan(days: Day[], budget: number, style: Style): Break[] {
  const off = (i: number) => i >= 0 && i < days.length && (days[i].weekend || !!days[i].holiday);
  const candidates = (minCost: number, maxCost: number, cap: number): Break[] => {
    const out: Break[] = [];
    for (let s = 0; s < days.length; s++) {
      if (off(s) || days[s].past) continue;
      const take: number[] = [];
      for (let e = s; e < days.length && take.length < Math.min(maxCost, cap); e++) {
        if (off(e)) continue;
        take.push(e);
        if (take.length < minCost) continue;
        let from = s;
        let to = e;
        while (off(from - 1) && !days[from - 1].past) from--;
        while (off(to + 1)) to++;
        if (to - from + 1 >= 3) out.push({ from, to, take: [...take], length: to - from + 1 });
      }
    }
    return out;
  };

  const best = (list: Break[], cap: number, blocked: Break[] = []): Break[] => {
    const free = list.filter((c) => blocked.every((b) => c.to < b.from - 1 || c.from > b.to + 1)).sort((a, b) => a.to - b.to);
    if (!free.length || cap <= 0) return [];
    // prev[i]: the last candidate that ends before candidate i begins.
    const prev = free.map((c) => {
      let lo = 0;
      let hi = free.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (free[mid].to < c.from) lo = mid + 1;
        else hi = mid;
      }
      return lo - 1;
    });
    // score[i][k]: most days away using the first i candidates and at most k days of leave.
    const score: Float64Array[] = [new Float64Array(cap + 1)];
    for (let i = 0; i < free.length; i++) {
      const row = new Float64Array(score[i]);
      const c = free[i];
      const cost = c.take.length;
      // A hair extra for cheaper breaks, so ties go to the plan that spends fewer days.
      const value = c.length + c.length / cost / 1000;
      for (let k = cost; k <= cap; k++) row[k] = Math.max(row[k], score[prev[i] + 1][k - cost] + value);
      score.push(row);
    }
    const out: Break[] = [];
    let k = cap;
    for (let i = free.length; i > 0; ) {
      if (score[i][k] === score[i - 1][k]) {
        i--;
        continue;
      }
      const c = free[i - 1];
      out.push(c);
      k -= c.take.length;
      i = prev[i - 1] + 1;
    }
    return out;
  };

  const cost = (list: Break[]) => list.reduce((a, b) => a + b.take.length, 0);
  const clear = (c: Break, list: Break[]) => list.every((b) => c.to < b.from - 1 || c.from > b.to + 1);

  /**
   * Spend what is left. First on the days that sit next to a holiday, which are worth more than a
   * plain Friday. Then on ordinary long weekends, each dropped into the longest stretch of the year
   * that has no break in it yet, so they end up spread out and not all in January.
   */
  const fill = (start: Break[]): Break[] => {
    let left = budget - cost(start);
    const out = [...start, ...best(candidates(1, 2, left).filter((c) => c.length / c.take.length > 3), left, start)];
    left = budget - cost(out);
    const plain = candidates(1, 1, 1).filter((c) => c.length === 3);
    const first = days.findIndex((d) => !d.past);
    for (; left > 0; left--) {
      const sorted = [...out].sort((a, b) => a.from - b.from);
      const edges = [first - 1, ...sorted.flatMap((b) => [b.from, b.to]), days.length];
      let pick: Break | null = null;
      let room = 0;
      for (let g = 0; g < edges.length; g += 2) {
        const lo = edges[g];
        const hi = edges[g + 1];
        if (hi - lo <= room) continue;
        const mid = (lo + hi) / 2;
        const inside = plain.filter((c) => c.from > lo && c.to < hi && clear(c, out));
        if (!inside.length) continue;
        room = hi - lo;
        pick = inside.reduce((a, b) => (Math.abs((a.from + a.to) / 2 - mid) <= Math.abs((b.from + b.to) / 2 - mid) ? a : b));
      }
      if (!pick) break;
      out.push(pick);
    }
    return out;
  };

  let chosen: Break[];
  if (style === "weekends") chosen = fill([]);
  else if (style === "trips") chosen = fill(best(candidates(3, 5, budget), budget));
  else {
    // One long trip first, up to two working weeks of leave, then spend what is left.
    const long = candidates(Math.min(6, budget), Math.min(10, budget), budget);
    chosen = fill(long.length ? [long.reduce((a, b) => (b.length > a.length || (b.length === a.length && b.take.length < a.take.length) ? b : a))] : []);
  }
  return chosen.sort((a, b) => a.from - b.from);
}
