# franklin.rocks

Personal site for Franklin Cheng. Next.js (App Router), Tailwind v4, no animation or 3D libraries.

```bash
npm install
npm run dev
```

## How the glass works

The look is liquid glass over a contour map. The map is there so the glass has something to bend.

- `src/lib/field/shader.ts` is one fragment shader. It draws the map and, on top of it, every glass slab:
  refraction along the bezel, a slight magnification, a little colour fringing, frost toward the centre,
  a rim light and a shadow. Because the map is procedural, this looks the same in every browser.
- `src/lib/field/engine.ts` owns the canvas and the frame loop. Glass elements register with it and it
  passes their rectangles to the shader each frame. The canvas is viewport sized but anchored to the
  document, so slabs never trail the text that sits on them while scrolling.
- `src/components/Glass.tsx` is the component to use. `kind` picks a preset from `PRESETS` in the engine:
  `panel`, `card`, `sheet` (frostier, for long reading), `badge` and `pill`. Tune bezel width, strength,
  frost and tint there.
- `src/components/HeroName.tsx` hands the headline to the engine, which draws it into the map so the badge
  can bend the letters. The real `<h1>` stays in the DOM for readers and search.
- `src/components/Badge.tsx` is the badge on the lanyard: a small verlet rope, draggable.
- `src/components/Nav.tsx` uses an SVG displacement filter as a `backdrop-filter` in Chromium, so page text
  bends as it scrolls under the bar. Other browsers get a frosted bar.

If WebGL 2 is missing, or the context is lost, every slab falls back to a frosted CSS surface and the
headline is drawn by the DOM again. `prefers-reduced-motion` stops the map drift, the parallax and the
badge's entrance swing.

Add `?still` to any URL for a motionless, full-quality render. The share image
(`src/app/opengraph-image.jpg`) is a capture of the home page in that mode.

## Fonts

Archivo is self-hosted from `src/app/fonts` and used across its width and weight axes. Instrument Serif
and JetBrains Mono are loaded only on `/play`, because the Signal // Noise canvas draws with them. All
three are under the SIL Open Font License; the licence files sit next to the fonts.

## Deploying

The Vercel project `franklin-portfolio` serves franklin.rocks. It is deployed with the Vercel CLI
(`vercel` for a preview, `vercel --prod` for production).
