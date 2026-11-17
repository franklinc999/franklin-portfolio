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

Each game lives in `src/components/play/<name>` as a plain engine class (three.js, its own frame loop,
no React inside) plus a small React shell for menus, HUD and results. `src/lib/games.ts` is the list
the cards on the home page, `/play` and `/projects` are drawn from. Sounds are synthesised in
`src/components/play/sound.ts`, so there are no audio files.

- **The Range** (`/play/range`): four aim drills. Mouse counts are turned into view angle with the
  same degrees-per-count as Valorant, Call of Duty or Apex, and pointer lock asks for raw input.
  Without pointer lock (touch, trackpad) a tap shoots where it lands. Append `?aim=cursor` to force
  that mode and `?debug` to expose the engine as `window.__range` for automated play.
