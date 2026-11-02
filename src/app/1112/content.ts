/**
 * EVERYTHING PERSONAL LIVES HERE.
 * Edit this file (and drop media into /public/1112/) and the whole gift updates.
 * Anything in [brackets] is a placeholder for you to replace.
 */

export type FlowerKind =
  | "rose"
  | "tulip"
  | "peony"
  | "ranunculus"
  | "daisy"
  | "lily"
  | "babysbreath"
  | "eucalyptus";

export const gift = {
  // --- who ---
  her: "[Her Name]",
  herNickname: "[nickname]",
  me: "Franklin",

  // --- when ---
  /** the day you became official, local time, YYYY-MM-DDTHH:mm */
  startedAt: "2024-11-12T00:00",
  /** the page stays locked (countdown) until this moment. Add ?preview=1 to the URL to bypass. */
  unlockAt: "2026-11-12T00:00",

  // --- the lock screen ---
  gate: {
    question: "what day did we start?",
    hint: "mm/dd/yy",
    /** accepted answers, compared lowercase with spaces / slashes / dots / dashes removed */
    answers: ["111224", "11122024", "1112"],
  },

  // --- fog mirror intro ---
  mirror: {
    /** written in the fog by an invisible finger before she wipes */
    fogMessage: "happy 2 years",
    /** revealed behind the fog. Put a photo of you two at /public/1112/mirror.jpg (portrait works best) */
    image: "/1112/mirror.jpg",
    underText: "two years of you",
  },

  // --- background music (starts after she unlocks, since browsers block autoplay) ---
  music: {
    src: "/1112/song.mp3",
    title: "[our song]",
  },

  // --- the film ---
  film: {
    /** export from gift-tools/build_film.py, then drop it here. Keep it under ~90MB for GitHub. */
    src: "/1112/film.mp4",
    poster: "/1112/film-poster.jpg",
    title: "a film about us",
    subtitle: "shot over 730 days, developed for one",
  },

  // --- the letter (the long, honest one; keep the handwritten paper copy as the original) ---
  letter: {
    greeting: "Dear [Her Name],",
    paragraphs: [
      "[Start with a specific memory from the very beginning. The first time you knew. Where you were, what she was wearing, what you were scared to say.]",
      "[Year one: one small moment nobody else would remember. Small and specific beats big and general every time.]",
      "[Year two: something she did that changed you. Name the change.]",
      "[What you notice about her that she doesn't think anyone notices.]",
      "[What you want year three to look like. One promise you will actually keep.]",
    ],
    signoff: "Always yours,",
    signature: "Franklin",
  },

  // --- moments (film strip). Photos go in /public/1112/moments/ ---
  moments: [
    { date: "2024-11-12", title: "day one", caption: "[where it started]", src: "/1112/moments/01.jpg" },
    { date: "2025-01-01", title: "[first new year]", caption: "[caption]", src: "/1112/moments/02.jpg" },
    { date: "2025-05-20", title: "[first trip]", caption: "[caption]", src: "/1112/moments/03.jpg" },
    { date: "2025-11-12", title: "one year", caption: "[caption]", src: "/1112/moments/04.jpg" },
    { date: "2026-03-14", title: "[a random tuesday]", caption: "[caption]", src: "/1112/moments/05.jpg" },
    { date: "2026-08-02", title: "[summer]", caption: "[caption]", src: "/1112/moments/06.jpg" },
  ],

  // --- bouquet: match this to the real flowers you buy. Tap a flower to read its note. ---
  bouquet: {
    title: "flowers that never wilt",
    wrap: "#e9dcc7",
    ribbon: "#7a1420",
    stems: [
      { kind: "rose", color: "#b3122e", count: 5, note: "[red roses: the obvious one, because I mean it]" },
      { kind: "peony", color: "#f2b6c1", count: 3, note: "[peonies: for the softest version of you]" },
      { kind: "ranunculus", color: "#f7d9a8", count: 2, note: "[ranunculus: you're charming, and I'm charmed]" },
      { kind: "babysbreath", color: "#ffffff", count: 4, note: "[baby's breath: everlasting]" },
      { kind: "eucalyptus", color: "#7d9a86", count: 3, note: "[eucalyptus: so the whole thing smells like home]" },
    ] as { kind: FlowerKind; color: string; count: number; note: string }[],
  },

  // --- the stock gift ---
  stock: {
    ticker: "[TICK]",
    company: "[Company Name]",
    shares: "[x.xx]",
    amount: 1112,
    why: "[Why this company: something that connects to her. A brand she loves, a thing she uses every day, a future you both believe in.]",
    rule: "We don't sell it. We check on it every anniversary.",
    /** used only for the illustrative "what it could grow into" chart */
    illustrativeAnnualReturn: 0.08,
  },

  // --- open when... envelopes ---
  openWhen: [
    { label: "you miss me", body: "[...]" },
    { label: "you had a bad day", body: "[...]" },
    { label: "you can't sleep", body: "[...]" },
    { label: "you doubt yourself", body: "[...]" },
    { label: "we just had a fight", body: "[...]" },
    { label: "it's our 3rd anniversary", body: "[a message for next year. She has to wait.]" },
  ],

  // --- reasons (shuffle deck) ---
  reasons: [
    "[the way you laugh at your own jokes before the punchline]",
    "[how you always know what to order for me]",
    "[reason 3]",
    "[reason 4]",
    "[reason 5]",
    "[reason 6]",
    "[reason 7]",
    "[reason 8]",
  ],

  // --- small stats you can fill in (gift-tools/scan_library.py prints some of these for you) ---
  stats: [
    { value: "[2,431]", label: "photos of us" },
    { value: "[37]", label: "restaurants" },
    { value: "[9]", label: "cities" },
    { value: "∞", label: "times you stole my hoodie" },
  ],

  finale: "to year three, and every one after it.",
};
