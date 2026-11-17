/** The games on the site, in the order they are shown. Only finished ones are listed. */
export type GameCard = {
  slug: string;
  name: string;
  kind: string;
  blurb: string;
  needs: string;
  /** Alt text for the capture at /assets/shots/<slug>.jpg. */
  alt: string;
};

export const GAMES: GameCard[] = [
  {
    slug: "range",
    name: "The Range",
    kind: "3D aim trainer",
    blurb:
      "Four drills in a real 3D range, with your Valorant, Call of Duty or Apex sensitivity carried over so the muscle memory is the same.",
    needs: "Best with a mouse",
    alt: "The Range: three glowing coral targets on a far wall, seen over the sights of a rifle in a dark plum hall",
  },
  {
    slug: "ops",
    name: "Live Ops",
    kind: "Strategy, about ten minutes",
    blurb:
      "Run eight weeks of a live game that does not exist. Ship new things, sell a little, fix what is broken, and try to have a team left at the end.",
    needs: "Works on a phone",
    alt: "Live Ops: a board of cards to ship this week, above meters for players, mood, stability, team and revenue",
  },
  {
    slug: "dink",
    name: "Dink",
    kind: "3D pickleball",
    blurb:
      "Singles against the computer on a real-size court at dusk. Pick your spot, time the swing, and work the other player out of position.",
    needs: "Mouse, finger or keyboard",
    alt: "Dink: a pickleball court at dusk seen from behind the near baseline, with palms against a coral sky",
  },
  {
    slug: "backlog",
    name: "The Backlog",
    kind: "3D boss fight",
    blurb:
      "One arena and one boss: a tower of blocks that gets faster as you cut it down. Every attack is drawn on the floor before it lands.",
    needs: "Keyboard and mouse, or thumbs",
    alt: "The Backlog: a small figure with a sword facing a tower of coloured blocks on a round arena, with a red circle filling in on the floor",
  },
];
