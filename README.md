# franklin.rocks

Personal site for Franklin Cheng. Next.js (App Router), Tailwind v4. The site itself uses no animation
or 3D libraries; the games under `/play` use three.js, which loads only on their pages.

```bash
npm install
npm run dev
```

## The idea

One page, five grounds. The home page runs through five zones, and each one has its own terrain, palette
and headline face, so scrolling feels like crossing a map rather than paging through cards:

| Zone        | Ground                         | Headline face       | Holds                          |
| ----------- | ------------------------------ | ------------------- | ------------------------------ |
| `abyss`     | deep-sea contour map           | Archivo, expanded   | the hero, the three sides      |
| `blueprint` | cobalt drafting grid           | Archivo + mono notes | agents and tools               |
| `arcade`    | plum halftone dots             | Jersey 25           | games                          |
| `paper`     | pale tea-green survey map      | Newsreader italic   | the personal part              |
| `sunset`    | wine-to-orange terrain bands   | Archivo, expanded   | contact                        |

Wrap a section in `<Zone theme="...">` and it gets that ground and that zone's ink. Zones meet along a
wobbling coastline instead of a straight edge.

## How the glass works

The glass is liquid glass, not a blur filter. The ground is there so the glass has something to bend.

- `src/lib/field/shader.ts` is one fragment shader. It draws the ground for every zone and, on top of it,
  every glass slab: refraction along the bezel, a slight magnification, a little colour fringing, frost
  toward the centre, a rim light and a shadow. Because the ground is procedural, this looks the same in
  every browser. There is a drawing of the optics on `/projects#glass`, generated from the live presets.
- `src/lib/field/engine.ts` owns the canvas and the frame loop. Glass elements, zones and field-drawn
  headings register with it and it passes them to the shader each frame. The canvas is viewport sized but
  anchored to the document, so slabs never trail the text that sits on them while scrolling.
- `src/components/Glass.tsx` is the component to use. `kind` picks a preset from `PRESETS` in the engine:
  `panel`, `card`, `sheet` (frostier, for long reading), `badge` and `pill`. Tune bezel width, strength,
  frost and tint there.
- `src/components/FieldHeading.tsx` and `HeroName.tsx` hand a heading to the engine, which draws it into
  the ground so glass can bend the letters, and ripples it in the first time it is scrolled to. The real
  heading stays in the DOM for readers and search. Field-drawn headings should use a `font-stretch` a
  canvas can name exactly (112.5% or 125%), or the drawn words will not land on their DOM boxes.
- `src/components/Badge.tsx` is the badge on the lanyard: a verlet rope with an elastic band. It can be
  pulled anywhere on screen, stretches past its length, and snaps back and swings when let go.
- `src/components/Nav.tsx` uses an SVG displacement filter as a `backdrop-filter` in Chromium, so page
  content bends as it scrolls under the bar. Other browsers get a frosted bar. Its ink follows the ground
  (`useToneUnder`): light over the dark zones, dark over the pale one.

## Motion

- The ground drifts, headings ripple in, slabs rise into place on first scroll, a droplet lens follows
  the cursor over open ground, and the phrase in the hero rolls.
- The sticker sheet under the hero is for hands, not eyes: peel a sticker, stick it anywhere on the page
  or onto the badge. Stickers on the badge ride along with it and are kept in `localStorage`.
- Pictures drift inside their frames and the glass drawing draws itself as it scrolls into view. Both are
  CSS scroll-driven animations behind `@supports`, so browsers without them simply show the final state.
- A dashed footpath follows the reader down the home page (`Trail.tsx` switches it on; the shader draws
  it as part of the ground, so glass bends it). The marker walks to where you are and the path stays drawn
  as far as you have been. On phones it keeps to the right-hand gutter.
- Pressing a control in the arcade zone knocks a few pixels loose (`Sparks.tsx`).
- `MotionToggle` (top right) pauses everything that moves on its own, and remembers the choice.
- `prefers-reduced-motion` removes movement and keeps fades. Use `useMotionOff()` in any new component
  that animates by itself.

## The small things built into the site

`src/components/lab/` holds the pieces made to be played with: `AgentLine` (a toy pipeline you can
break), `SensConverter` (mouse sensitivity between shooters), `TeaTimer` (gongfu steeps) and
`SlabAnatomy` (the glass drawing) and `GlassPlayground` (a live slab with dials for the same variables
the drawing names; it uses `field.tune()` to override one slab's optics).

Two things on the site are paper instead of glass, because they are for hands: the sticker sheet
(`Stickers.tsx`) and the postcard in the contact block (`Postcard.tsx`). The postcard has no backend. Its
"Send it" link is a `mailto:` built from what was typed, so the message goes out from the visitor's own
mail app.

## Fallbacks

If WebGL 2 is missing, or the context is lost, every slab falls back to a frosted CSS surface, each zone
falls back to a flat colour of its own (see "Fallback grounds" in `globals.css`), and headings are drawn
by the DOM again.

Add `?still` to any URL for a motionless, full-quality render. The share image
(`src/app/opengraph-image.jpg`) is a capture of the home page in that mode, and the game pictures in
`public/assets/shots` are real frames captured from each game.

## Fonts

All self-hosted from `src/app/fonts`, all under the SIL Open Font License (licence files sit next to the
fonts): Archivo (the site's voice, used across its width and weight axes), Newsreader (the personal
zone), Caveat (margin notes), Jersey 25 (the arcade) and JetBrains Mono (figures and annotations).
## Deploying

The Vercel project `franklin-portfolio` serves franklin.rocks. It is deployed with the Vercel CLI
(`vercel` for a preview, `vercel --prod` for production).

## Games

Each game is its own world. Nothing in a game borrows from the site: every one has its own fonts
(loaded only on its route, from `src/app/play/<name>/fonts`), its own stylesheet next to its component,
its own menus, HUD and results. The only thing they share is how they are built: a plain engine class
(three.js, its own frame loop, no React inside) plus a small React shell. `src/lib/games.ts` is the
list the cards on the home page, `/play` and `/projects` are drawn from. Sounds are synthesised in
`src/components/play/sound.ts`, so there are no audio files.

| Game | Looks like | Faces |
| ---- | ---------- | ----- |
| The Range (`/play/range`) | a desert range at noon: clays, a dirt backstop, a range card | Saira Stencil One, Saira Condensed |
| Live Ops (`/play/ops`) | a harbor master's ledger, with the harbor drawn from the state of the season | Fraunces, Nunito |
| Dink (`/play/dink`) | a 1970s rec league poster with vegetables for players | Bowlby One, Rubik |
| The Backlog (`/play/backlog`) | a photo of a desk: cutting mat, sticky notes, label tape, a memo | Permanent Marker, Special Elite |

- **The Range**: four stages, first person. With a mouse, pointer lock asks for raw input and mouse
  counts become view angle with the same degrees-per-count as Valorant, Call of Duty or Apex. On a
  touch screen the stage goes full screen, a dragging thumb turns the view (look speed is a ratio of
  picture movement to thumb movement, so it feels the same upright or sideways), a Fire button or a
  second thumb shoots at the crosshair, and the lens tightens so the clays stay big enough to hit.
  If the browser refuses pointer lock, a click shoots where it lands. Every hit is recorded as an
  offset from the centre of its target, and the results screen plots them on one paper target.
  `?aim=cursor` forces click-to-shoot and `?debug` exposes the engine as `window.__range`.
- **The cast** (`src/components/play/cast`): the row of four figures above the cards on `/play`,
  one from each game. Plain three.js, fetched only once the row is on the page. One renderer draws
  all four by painting each figure into the rectangle of its own slot in the page, so the layout is
  ordinary CSS and each cell is a real link. Drag spins a figure, the pause switch stops them, and
  `?debug` exposes the engine as `window.__cast`.
- **Live Ops**: an eight week strategy game. The rules are a pure seeded model in `ops/model.ts`
  (state in, state out), so the balance could be simulated outside the browser; the grade thresholds
  come from doing that. `Harbor.tsx` draws the scene from the meters: boats for players, weather for
  mood, the lighthouse for stability, lit windows for the team, crates for revenue. `?seed=7` replays
  a season.
- **Dink**: singles pickleball on a court built to scale. Both players run on their own; you choose
  the spot and the moment. The three opponents differ in speed, reaction time and how often they
  miss, and were tuned by stepping the engine through a few hundred matches without drawing.
  `?debug` exposes it as `window.__pickle`.
- **The Backlog**: a boss fight worked out on the ground plane. Every attack is something a desk
  would have on it, shown on the mat before it lands. The boss's health is drawn as a burndown
  chart. Health, stamina costs and the ring's point-blank grace were set by fighting it with bots of
  different reaction speed. `?debug` exposes it as `window.__boss`.

## Tools

Three small tools live under `/tools`, in the paper zone: a gratitude journal
(`three-good-things`), a days-since-you-called counter (`call-home`) and a PTO planner (`pto`), which
picks the working days to take so a leave budget turns into the most days away (the search is in
`src/components/tools/pto.ts`).
They replace links to older versions hosted elsewhere. The first two keep their data in
`localStorage` and send nothing anywhere; the calendar file from `call-home` is built in the page.
`src/lib/tools.ts` is the list the cards are drawn from.

## Third-party notices

- The seal on the badge (`src/components/Seal.tsx`) runs the Liquid Metal shader from
  [Paper Shaders](https://shaders.paper.design) (`@paper-design/shaders`, Apache License 2.0,
  Copyright 2026 Paper). Powered by Paper Shaders: https://shaders.paper.design. One line of the
  shader is changed at load, noted in that file. The mark's edge map,
  `public/assets/fc-mark-metal.png`, was made ahead of time from `public/assets/fc-mark.svg` with
  the same package's `toProcessedLiquidMetal`, so visitors do not run that step.
