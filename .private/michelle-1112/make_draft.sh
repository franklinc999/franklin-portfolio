#!/usr/bin/env bash
# One command, morning draft.
#   cd .private/michelle-1112 && ./make_draft.sh ~/Music/our-song.mp3
# Optional env: HER="Michelle" ME="Franklin" SINCE=2024-11-12 N=32 ALL_VIDEOS=1 WORK=~/Desktop/michelle-1112
set -euo pipefail

HER="${HER:-Michelle}"
ME="${ME:-Franklin}"
SINCE="${SINCE:-2024-11-12}"
N="${N:-32}"
WORK="${WORK:-$HOME/Desktop/michelle-1112}"
SONG="${1:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
TOOLS="$HERE/gift-tools"

say() { printf "\n\033[38;5;208m== %s\033[0m\n" "$*"; }

say "1/6 tools"
command -v brew >/dev/null || { echo "install Homebrew first: https://brew.sh"; exit 1; }
command -v ffmpeg >/dev/null || brew install ffmpeg
command -v node >/dev/null || brew install node
cd "$TOOLS"
[ -d .venv ] || python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q opencv-python-headless"<5" numpy pillow pillow-heif osxphotos
# nice-to-haves: the scripts fall back gracefully if these can't install on your Python
pip install -q mediapipe || echo "(mediapipe unavailable: using basic face detection)"
pip install -q librosa || echo "(librosa unavailable: cuts won't be beat-synced)"

say "2/6 who Photos knows"
PERSONS="$(osxphotos persons 2>/dev/null || true)"
echo "$PERSONS" | head -25
if ! grep -qi -- "$HER" <<<"$PERSONS"; then
  echo "!! Photos has no person named '$HER'. Set HER=\"name as shown in Photos > People\" and re-run."
  exit 1
fi
grep -qi -- "$ME" <<<"$PERSONS" || echo "(no person named '$ME' in Photos; set ME=... to get the 'both of you' boost)"

say "3/6 exporting everything with $HER since $SINCE (first run can take a while; re-runs are incremental)"
mkdir -p "$WORK/raw"
# photos + videos Photos tagged with her. --download-missing pulls iCloud originals.
osxphotos export "$WORK/raw" --person "$HER" --from-date "$SINCE" \
  --sidecar json --convert-to-jpeg --jpeg-quality 0.9 --skip-original-if-edited \
  --download-missing --update --skip-live || echo "(some files failed to export, continuing)"
# Photos rarely tags people in videos, so also grab videos of you, and your favorite videos
osxphotos export "$WORK/raw" --person "$ME" --only-movies --from-date "$SINCE" \
  --sidecar json --download-missing --update || true
osxphotos export "$WORK/raw" --favorite --only-movies --from-date "$SINCE" \
  --sidecar json --download-missing --update || true
if [ "${ALL_VIDEOS:-0}" = "1" ]; then
  osxphotos export "$WORK/raw" --only-movies --from-date "$SINCE" --sidecar json --download-missing --update || true
fi

say "4/6 scanning for the best moments"
python3 scan_library.py "$WORK/raw" --since "$SINCE" --out "$WORK/scan" --people "$HER" "$ME"

say "5/6 picking a first cut + filling the gift site"
CAPS=()
[ -f "$TOOLS/captions.txt" ] && CAPS=(--captions "$TOOLS/captions.txt")
python3 auto_pick.py "$WORK/scan/library.json" --out "$WORK/picks.json" --site "$HERE" --n "$N" "${CAPS[@]+"${CAPS[@]}"}"

say "6/6 rendering the draft film"
LUT=()
[ -f "$TOOLS/luts/film.cube" ] && LUT=(--lut "$TOOLS/luts/film.cube")
MUSIC=()
[ -n "$SONG" ] && MUSIC=(--music "$SONG")
python3 build_film.py "$WORK/picks.json" --out "$WORK/draft.mp4" --poster "$WORK/draft-poster.jpg" \
  --preset fast "${MUSIC[@]+"${MUSIC[@]}"}" "${LUT[@]+"${LUT[@]}"}"
mkdir -p "$HERE/public/media"
cp "$WORK/draft.mp4" "$HERE/public/media/film.mp4"
cp "$WORK/draft-poster.jpg" "$HERE/public/media/film-poster.jpg"
[ -n "$SONG" ] && cp "$SONG" "$HERE/public/media/song.mp3"

say "done"
echo "film:          $WORK/draft.mp4"
echo "contact sheet: $WORK/scan/index.html  (re-pick, export picks.json, re-run build_film.py)"
echo "edit the cut:  $WORK/picks.json"
echo "gift site:     cd $HERE && npm install && npm run dev   -> open the URL with ?preview=1"
open "$WORK/draft.mp4" 2>/dev/null || true
open "$WORK/scan/index.html" 2>/dev/null || true
