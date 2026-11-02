# michelle 11.12

Private anniversary gift. Not part of the portfolio site: it lives in a hidden folder, is excluded from the Next.js build, and never deploys.

## Tomorrow morning (one command, on your Mac)

```bash
cd ~/path/to/franklin-portfolio/.private/michelle-1112
./make_draft.sh ~/Music/our-song.mp3     # song is optional
```

What it does:
1. Installs ffmpeg, node and the Python tools if they're missing.
2. Asks Apple Photos which people it knows and checks that "Michelle" is one of them. If the names differ, run `HER="..." ME="..." ./make_draft.sh`.
3. Exports every photo and video tagged with Michelle since 2024-11-12, plus videos tagged with you and your favorite videos. It pulls originals down from iCloud if needed, and re-runs only fetch new files. Add `ALL_VIDEOS=1` to also scan every video, which takes much longer.
4. Scores everything: both of you tagged together, real smiles, sharpness, light, motion. It finds the best 3 seconds inside each video and drops burst duplicates.
5. Picks about 32 clips across every month, in date order. It also fills the gift page with the best photo of you two (behind the fog mirror), 6 film-strip photos and real stats.
6. Renders `~/Desktop/michelle-1112/draft.mp4` in the 2000s-film / Wong Kar-wai look, with cuts on the beat. Then it opens the film and a contact sheet for re-picking.

Then preview the gift: `npm install && npm run dev`, and open the printed URL with `?preview=1`.

## Making it yours
- `src/content.ts`: the letter, reasons, bouquet, stock, open-when notes and password.
- `gift-tools/captions.txt`: subtitle lines for the film (copy `captions.example.txt`). Re-run the script.
- `~/Desktop/michelle-1112/picks.json`: reorder clips, change captions, set `"fx": "step"`, `"keepAudio": true` or `"speed": 0.7`. Then:
  `gift-tools/.venv/bin/python gift-tools/build_film.py ~/Desktop/michelle-1112/picks.json --music song.mp3 --out ~/Desktop/michelle-1112/film.mp4`
- Details: `gift-tools/README.md`.

## Giving it to her on 11/12
`npm run build` creates `dist/`, a static folder that works anywhere. Some options:
- Drag `dist/` onto https://app.netlify.com/drop for a private random URL. Text it to her, or put it in a QR code on the flower card.
- Or open it on your laptop and hand it to her.

Photos and videos in `public/media/` are git-ignored, so they never go to GitHub.
