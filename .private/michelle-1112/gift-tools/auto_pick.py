#!/usr/bin/env python3
"""
auto_pick.py: turn scan/library.json into a first-draft edit and fill the gift site.

  * picks ~N clips spread across every month, favouring shots Photos tagged with both of you,
    real smiles, and a ~60/40 video/photo mix; keeps them in date order
  * marks lively videos for the step-printed smear
  * sprinkles captions from captions.txt (one line per caption, e.g. lines from your letter)
  * writes picks.json for build_film.py
  * copies the best "together" portrait to the site as the fog-mirror photo
  * copies 6 film-strip photos (one per era) and writes src/moments.generated.ts + stats

Usage: python3 auto_pick.py scan/library.json --out picks.json --site .. [--n 32] [--captions captions.txt]
"""
import argparse
import datetime as dt
import json
import shutil
import subprocess
from pathlib import Path


def to_jpeg(src, dst, max_px=1600):
    dst.parent.mkdir(parents=True, exist_ok=True)
    try:
        from PIL import Image, ImageOps

        try:
            from pillow_heif import register_heif_opener  # type: ignore

            register_heif_opener()
        except Exception:
            pass
        im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        im.thumbnail((max_px, max_px))
        im.save(dst, quality=88)
    except Exception:
        shutil.copy(src, dst)


def video_still(src, t, dst):
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", src, "-frames:v", "1", "-q:v", "3",
                    "-vf", "scale='min(1600,iw)':-2", str(dst)], check=False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("library")
    ap.add_argument("--out", default="picks.json")
    ap.add_argument("--site", help="path to the michelle-1112 site folder to fill (mirror photo, moments, stats)")
    ap.add_argument("--n", type=int, default=32)
    ap.add_argument("--captions", help="text file, one caption per line")
    a = ap.parse_args()

    lib = json.loads(Path(a.library).read_text())
    if not lib:
        raise SystemExit("library is empty")
    for r in lib:
        r["_d"] = dt.datetime.fromisoformat(r["date"])
        r["_s"] = r["score"] + (0.06 if r["type"] == "video" else 0)  # video makes a film feel alive

    months = sorted({r["month"] for r in lib})
    per = max(1, round(a.n / len(months)))
    picks = []
    for mo in months:
        pool = sorted((r for r in lib if r["month"] == mo), key=lambda r: -r["_s"])
        chosen = []
        for r in pool:
            if len(chosen) >= per:
                break
            # avoid two picks from the same few minutes
            if any(abs((r["_d"] - c["_d"]).total_seconds()) < 600 for c in chosen):
                continue
            chosen.append(r)
        picks += chosen
    # trim / top up to N by score, then restore date order
    picks = sorted(picks, key=lambda r: -r["_s"])[: a.n]
    if len(picks) < a.n:
        rest = sorted((r for r in lib if r not in picks), key=lambda r: -r["_s"])
        picks += rest[: a.n - len(picks)]
    picks.sort(key=lambda r: r["_d"])

    caps = []
    if a.captions and Path(a.captions).exists():
        caps = [l.strip() for l in Path(a.captions).read_text().splitlines() if l.strip()]
    cap_at = {}
    if caps:
        # spread captions evenly, skipping the first two clips so the film breathes first
        span = max(1, len(picks) - 2)
        for k, c in enumerate(caps):
            cap_at[2 + int(k * span / len(caps))] = c

    out = []
    for i, r in enumerate(picks):
        e = {"path": r["path"], "type": r["type"], "date": r["date"], "caption": cap_at.get(i, ""),
             "fx": "step" if r["type"] == "video" and r.get("motion", 0) > 0.07 else "", "keepAudio": False}
        if r["type"] == "video":
            e.update(t_in=r.get("t_in", 0), t_out=r.get("t_out", 3))
            if r.get("motion", 0) < 0.03:
                e["speed"] = 0.8  # calm clips get the dreamy slow treatment
        out.append(e)
    Path(a.out).write_text(json.dumps(out, indent=2))
    nv = sum(1 for e in out if e["type"] == "video")
    print(f"picked {len(out)} clips ({nv} videos, {len(out) - nv} photos) across {len(months)} months -> {a.out}")

    if not a.site:
        return
    site = Path(a.site)
    media = site / "public" / "media"
    # fog mirror: best portrait-ish photo of the two of you
    together = sorted((r for r in lib if r.get("together")), key=lambda r: -r["score"]) or sorted(lib, key=lambda r: -r["score"])
    mirror = next((r for r in together if r["type"] == "photo"), together[0])
    if mirror["type"] == "photo":
        to_jpeg(mirror["path"], media / "mirror.jpg")
    else:
        video_still(mirror["path"], mirror.get("t_in", 0) + 1, media / "mirror.jpg")
    print(f"mirror photo: {Path(mirror['path']).name}")

    # film strip: 6 eras, best together shot in each
    lib_sorted = sorted(lib, key=lambda r: r["_d"])
    k = 6
    moments = []
    for j in range(k):
        seg = lib_sorted[j * len(lib_sorted) // k : (j + 1) * len(lib_sorted) // k]
        if not seg:
            continue
        best = max(seg, key=lambda r: r["score"] + (0.2 if r.get("together") else 0) + (0.05 if r["type"] == "photo" else 0))
        dst = media / "moments" / f"{j + 1:02d}.jpg"
        if best["type"] == "photo":
            to_jpeg(best["path"], dst)
        else:
            video_still(best["path"], best.get("t_in", 0) + 1, dst)
        moments.append({"date": best["date"][:10], "title": best["_d"].strftime("%B %Y").lower(), "caption": "[caption]",
                        "src": f"media/moments/{j + 1:02d}.jpg"})

    photos = sum(1 for r in lib if r["type"] == "photo")
    videos = len(lib) - photos
    gen = site / "src" / "moments.generated.ts"
    gen.write_text(
        "// written by gift-tools/auto_pick.py. Edit captions in content.ts overrides, or re-run the script.\n"
        f"export const generatedMoments = {json.dumps(moments, indent=2)};\n\n"
        f"export const generatedStats = {json.dumps([{'value': f'{photos:,}', 'label': 'photos of us'}, {'value': f'{videos:,}', 'label': 'videos'}, {'value': str(len(months)), 'label': 'months of memories'}], indent=2)};\n"
    )
    print(f"site filled: mirror.jpg, {len(moments)} film-strip photos, stats -> {gen}")


if __name__ == "__main__":
    main()
