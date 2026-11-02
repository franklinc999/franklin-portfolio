# 11.12 gift tools

Everything for the anniversary film, run on your Mac. Most of the time you just run `../make_draft.sh` (see ../README.md). This page explains each step if you want to tweak.

## 0. Setup (once)

```bash
brew install ffmpeg
cd .private/michelle-1112/gift-tools
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## 1. Get the footage out of Photos

Best option: `osxphotos`. It reads Apple Photos' own face recognition, so you can pull only the photos she's in:

```bash
pip install osxphotos
# everything with her in it since you started (name her in Photos > People first)
osxphotos export ~/Desktop/us --person "Her Name" --from-date 2024-11-12 --convert-to-jpeg --skip-edited
# add your favorites and anything from shared albums too
osxphotos export ~/Desktop/us --favorite --from-date 2024-11-12 --convert-to-jpeg --update
```

No osxphotos? In Photos, select an album, File > Export > Export Unmodified Originals to a folder.

## 2. Scan and pick

```bash
python3 scan_library.py ~/Desktop/us --since 2024-11-12 --out ./scan
open scan/index.html
```

The scanner scores every file: who Photos tagged (both of you = big boost, read from osxphotos `--sidecar json`), real smiles and faces via MediaPipe Face Landmarker (falls back to Haar), sharpness, exposure, motion. It, finds the best 3 second window inside every video, drops burst duplicates, and prints stats you can paste into `content.ts` (photo count, months, etc.).

In the contact sheet: tap to pick, or hit "auto-pick top 2 per month", then **export picks.json**.

Aim for 25 to 40 clips for a 90 to 120 second film. That's Instagram Reels length, and short enough to rewatch.

## 3. Edit picks.json (this is where it becomes a love letter)

Each entry:

```json
{
  "path": "/Users/you/Desktop/us/IMG_1234.MOV",
  "type": "video",
  "date": "2025-03-14T19:20:00",
  "t_in": 4.5, "t_out": 7.5,
  "caption": "you laughed so hard you cried",
  "fx": "step",
  "keepAudio": true,
  "speed": 0.75
}
```

- **Reorder** freely. Chronological is the default, but grouping by feeling (nervous beginning, the trips, the quiet everyday stuff, now) works better.
- **caption**: yellow serif subtitles, like in a Wong Kar-wai film. Use short lines from your letter, a few words each, and leave most clips without one.
- **fx: "step"** gives the Chungking Express step-printed smear. Best on clips with movement: walking, spinning, city lights, a train.
- **keepAudio**: keep the clip's real sound (her laugh, a voice) and duck the music under it.
- **speed**: 0.5 to 0.8 makes it dreamy and slow.

## 4. Render

```bash
# quick draft
python3 build_film.py picks.json --music song.mp3 --out draft.mp4 --preset ultrafast
# final
python3 build_film.py picks.json --music song.mp3 --out film.mp4 --poster film-poster.jpg \
  --title "11 . 12" --title-sub "a film about us" --end "to year three"
```

Cuts land on the song's bars automatically (librosa; install `beat-this` for even better downbeats). `--beats 2` cuts every 2 beats, `--beats 0` turns it off. `--lut file.cube` applies a film LUT first (free CineStill 800T: https://picturefx.itch.io/picturefx-cinestill-800t-v20, save it as `gift-tools/luts/film.cube` and the draft script uses it).

Options: `--aspect 9:16 | 4:5 | 1:1 | 16:9 | 4:3`, `--strength 0..1.5` (grade intensity), `--grain 0..25`, `--xfade 0.5`, `--no-stamp`.

Fonts: put `VT323-Regular.ttf` (the digicam date stamp) and `CormorantGaramond-Italic.ttf` (subtitles) in `gift-tools/fonts/` for the exact look. Both are free on Google Fonts. Otherwise it falls back to Menlo / Georgia.

Then copy `film.mp4` and `film-poster.jpg` into `public/media/` (git-ignored, so your photos never hit GitHub).

## Where AI tools fit

- **Higgsfield** (or Kling / Runway / Veo): image-to-video on 3 or 4 of your best *still photos*. Give each one a slow dolly-in or a hair-in-the-wind move and they become living shots. Prompt idea: *"slow push in, 35mm film, warm tungsten light, shallow depth of field, Wong Kar-wai, step-printed motion blur, grain"*. Export them, then add them to picks.json as `"type": "video"`.
- Don't use AI on her face for anything more than subtle motion. Real footage is the whole point.
- For the newly recorded moments, shoot handheld at 24fps. Shoot through glass, neon, rain on windows and mirrors (fog the bathroom mirror for real!), with practical lamps and no overhead lights. Film her from slightly too far away, the way WKW does.

## Tools I looked at (Nov 2026)

- **osxphotos**: the only real way to use Apple's face recognition from a script. Kept.
- **MediaPipe Face Landmarker**: now does faces and smiles (blendshapes). Much better than Haar.
- **aesthetic-predictor-v2-5** (SigLIP): a better "is this a beautiful photo" score, but it needs PyTorch (~2GB) and is AGPL. Worth adding later if the auto picks feel off.
- **Beat This!** (CPJKU): the most accurate downbeat tracker. Optional; librosa is the default.
- **Remotion**, plus Remotion's official Claude Code skills (`npx skills add remotion-dev/skills`): the step up if you want animated React titles. ffmpeg covers this edit.
- **digitalsamba/claude-code-video-toolkit**: Claude Code skills for ffmpeg, moviepy and remotion.
- I found no fog-mirror repo or Instagram reel that shares code, so the mirror is custom canvas work.
