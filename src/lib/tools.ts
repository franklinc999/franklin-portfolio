/** Small tools that live on the site. Each keeps its data in the visitor's own browser. */
export type Tool = { slug: string; name: string; blurb: string; note: string };

export const TOOLS: Tool[] = [
  {
    slug: "three-good-things",
    name: "Three Good Things",
    blurb: "A gratitude journal I built during a rough patch. Three good moments a day, and a way to look back at them.",
    note: "Kept in your browser",
  },
  {
    slug: "call-home",
    name: "Did You Call Your Parents?",
    blurb: "Born from not calling home for two months. It counts the days for you and says when it has been too long.",
    note: "Kept in your browser",
  },
  {
    slug: "pto",
    name: "PTO Planner",
    blurb: "Tell it how many days you have and which holidays your company gives. It finds the days to take that add up to the most time off.",
    note: "Nothing is saved",
  },
];
