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
      "Four stages on a desert range, breaking clays, with your Valorant, Call of Duty or Apex sensitivity carried over. Your shots come back plotted on a paper target.",
    needs: "Mouse, or thumbs on a phone",
    alt: "The Range: orange clay targets on rods in front of a dirt backstop under a blue sky, seen over a rifle, with a stencilled timer",
  },
  {
    slug: "ops",
    name: "Live Ops",
    kind: "Strategy, about ten minutes",
    blurb:
      "Run eight weeks of a cozy game that does not exist, from the harbor master's ledger. The harbor fills with boats when it is going well and rains when it is not.",
    needs: "Works on a phone",
    alt: "Live Ops: a cream ledger page with a drawing of a harbor full of sailing boats, a lighthouse and kites, above figures and cargo tags",
  },
  {
    slug: "dink",
    name: "Dink",
    kind: "3D pickleball",
    blurb:
      "A Sunday rec league, drawn like a 1970s poster. You are a pickle. Across the net is an onion, a carrot or a chili, and each one plays differently.",
    needs: "Mouse, finger or keyboard",
    alt: "Dink: a flat-colour pickleball court with bunting and a big sun, a pickle in a headband facing a chili pepper across the net",
  },
  {
    slug: "backlog",
    name: "The Backlog",
    kind: "3D boss fight",
    blurb:
      "You are three centimetres tall, on a desk, with a pencil. The boss is a stack of sticky notes, and its attacks are a rubber stamp, a highlighter and a coffee ring.",
    needs: "Keyboard and mouse, or thumbs",
    alt: "The Backlog: a tiny figure in a yellow beanie on a green cutting mat, facing a tower of sticky note pads inside a red URGENT stamp",
  },
];
