#!/usr/bin/env python3
"""
scan_library.py: find the best moments in a camera roll export.

Walks a folder of photos/videos, scores every file (faces, smiles, sharpness,
exposure, motion), picks the best N-second window inside each video, removes
near-duplicate burst shots, and writes:

  out/library.json   every file with its scores and best window
  out/index.html     a contact sheet you open in a browser to pick clips;
                     the "export picks" button saves picks.json for build_film.py
  out/thumbs/        thumbnails used by the contact sheet

Usage:
  python3 scan_library.py ~/Pictures/us-export --since 2024-11-12 --out ./scan
Requires: pip install -r requirements.txt  (optional: pillow-heif for .HEIC)
and ffprobe (brew install ffmpeg).
"""
import argparse
import datetime as dt
import html
import json
import os
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

try:
    from pillow_heif import register_heif_opener  # type: ignore

    register_heif_opener()
    HEIF = True
except Exception:
    HEIF = False

PHOTO_EXT = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"}
VIDEO_EXT = {".mov", ".mp4", ".m4v", ".avi"}
CASCADES = cv2.data.haarcascades
FACE = None
SMILE = None


def _cascades():
    global FACE, SMILE
    if not hasattr(cv2, "CascadeClassifier"):
        sys.exit('this OpenCV build has no Haar cascades; run: pip install "opencv-python-headless<5"')
    if FACE is None:
        FACE = cv2.CascadeClassifier(os.path.join(CASCADES, "haarcascade_frontalface_default.xml"))
        SMILE = cv2.CascadeClassifier(os.path.join(CASCADES, "haarcascade_smile.xml"))
    return FACE, SMILE


# ---------------------------------------------------------------- metadata
def ffprobe(path):
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", str(path)],
            capture_output=True, text=True, timeout=30,
        ).stdout
        return json.loads(out or "{}")
    except Exception:
        return {}


def parse_date(s):
    if not s:
        return None
    s = s.strip().replace("Z", "+00:00")
    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S"):
        try:
            d = dt.datetime.strptime(s, fmt)
            return d.replace(tzinfo=None)
        except ValueError:
            continue
    try:
        return dt.datetime.fromisoformat(s).replace(tzinfo=None)
    except ValueError:
        return None


def photo_date(path, img):
    """EXIF DateTimeOriginal (36867) > DateTimeDigitized (36868) > DateTime (306)."""
    try:
        exif = img.getexif()
        sub = exif.get_ifd(0x8769)
        v = sub.get(36867) or sub.get(36868) or exif.get(306)
        return parse_date(str(v)) if v else None
    except Exception:
        return None


# ---------------------------------------------------------------- scoring
def frame_metrics(bgr):
    """Return dict of raw metrics for one frame (BGR uint8)."""
    face_c, smile_c = _cascades()
    h, w = bgr.shape[:2]
    scale = 480.0 / max(h, w)
    small = cv2.resize(bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    sharp = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    bright = float(gray.mean()) / 255.0
    sat = float(cv2.cvtColor(small, cv2.COLOR_BGR2HSV)[..., 1].mean()) / 255.0
    faces = face_c.detectMultiScale(gray, scaleFactor=1.15, minNeighbors=5, minSize=(28, 28))
    n_faces = len(faces)
    face_area = 0.0
    smiles = 0
    for (x, y, fw, fh) in faces:
        face_area = max(face_area, (fw * fh) / float(gray.shape[0] * gray.shape[1]))
        roi = gray[y + fh // 2 : y + fh, x : x + fw]
        if roi.size and len(smile_c.detectMultiScale(roi, scaleFactor=1.7, minNeighbors=18, minSize=(12, 12))):
            smiles += 1
    return {"sharp": sharp, "bright": bright, "sat": sat, "faces": n_faces, "face_area": face_area, "smiles": smiles, "gray": gray}


def score(m, motion=None):
    sharp_n = min(1.0, np.log1p(m["sharp"]) / np.log1p(900))
    exposure = 1.0 - min(1.0, abs(m["bright"] - 0.5) * 2.2)
    faces = min(1.0, m["faces"] / 2.0)  # two people in frame is the sweet spot
    closeness = min(1.0, m["face_area"] * 12)
    smile = min(1.0, m["smiles"] / 2.0)
    s = 0.25 * faces + 0.12 * closeness + 0.2 * smile + 0.2 * sharp_n + 0.13 * exposure + 0.05 * m["sat"]
    if motion is not None:
        # a little motion is alive; a lot is shaky
        s += 0.05 * (1.0 - abs(min(motion, 0.2) - 0.06) / 0.14)
        if motion > 0.25:
            s -= 0.15
    return float(max(0.0, s))


def dhash(gray):
    g = cv2.resize(gray, (9, 8), interpolation=cv2.INTER_AREA)
    bits = (g[:, 1:] > g[:, :-1]).flatten()
    return int("".join("1" if b else "0" for b in bits), 2)


# ---------------------------------------------------------------- per file
def analyze(path_str, thumbs_dir, clip_len, step):
    path = Path(path_str)
    ext = path.suffix.lower()
    rec = {"path": str(path), "name": path.name, "type": "video" if ext in VIDEO_EXT else "photo"}
    try:
        thumb = Path(thumbs_dir) / (str(abs(hash(str(path)))) + ".jpg")
        if rec["type"] == "photo":
            img = Image.open(path)
            d = photo_date(path, img)
            img = img.convert("RGB")
            bgr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
            m = frame_metrics(bgr)
            rec.update(date=d, score=score(m), faces=m["faces"], smiles=m["smiles"], sharp=m["sharp"], hash=dhash(m["gray"]))
            img.thumbnail((360, 360))
            img.save(thumb, quality=80)
        else:
            meta = ffprobe(path)
            tags = (meta.get("format") or {}).get("tags") or {}
            d = parse_date(tags.get("com.apple.quicktime.creationdate") or tags.get("creation_time"))
            cap = cv2.VideoCapture(str(path))
            fps = cap.get(cv2.CAP_PROP_FPS) or 30
            n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            dur = n / fps if n else float((meta.get("format") or {}).get("duration") or 0)
            samples = []
            prev = None
            t = 0.25
            best_frame = None
            while t < max(dur - 0.1, 0.3):
                cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
                ok, frame = cap.read()
                if not ok:
                    break
                m = frame_metrics(frame)
                motion = float(np.mean(cv2.absdiff(m["gray"], prev)) / 255.0) if prev is not None and prev.shape == m["gray"].shape else 0.05
                prev = m["gray"]
                sc = score(m, motion)
                samples.append((t, sc, m["faces"], m["smiles"], motion))
                if best_frame is None or sc > best_frame[0]:
                    best_frame = (sc, frame, m["gray"])
                t += step
            cap.release()
            if not samples:
                rec.update(date=d, score=0.0, duration=dur, error="unreadable")
                return rec
            # best window of clip_len seconds
            win = max(1, int(round(clip_len / step)))
            scores = [s[1] for s in samples]
            best_i, best_v = 0, -1.0
            for i in range(0, max(1, len(scores) - win + 1)):
                v = float(np.mean(scores[i : i + win]))
                if v > best_v:
                    best_i, best_v = i, v
            t_in = max(0.0, samples[best_i][0] - step / 2)
            t_out = min(dur, t_in + clip_len)
            rec.update(
                date=d, duration=round(dur, 2), score=best_v, t_in=round(t_in, 2), t_out=round(t_out, 2),
                faces=max(s[2] for s in samples), smiles=sum(s[3] for s in samples),
                motion=float(np.mean([s[4] for s in samples])), hash=dhash(best_frame[2]),
            )
            # thumbnail from best moment
            bf = best_frame[1]
            h, w = bf.shape[:2]
            k = 360.0 / max(h, w)
            cv2.imwrite(str(thumb), cv2.resize(bf, (int(w * k), int(h * k))), [cv2.IMWRITE_JPEG_QUALITY, 80])
        if rec.get("date") is None:
            rec["date"] = dt.datetime.fromtimestamp(path.stat().st_mtime)
            rec["date_guessed"] = True
        rec["thumb"] = "thumbs/" + thumb.name
    except Exception as e:  # keep going on bad files
        rec.update(score=0.0, error=str(e)[:200])
    return rec


def dedupe(recs, minutes=10, max_bits=6):
    recs = sorted(recs, key=lambda r: -r.get("score", 0))
    kept = []
    for r in recs:
        if "hash" not in r or not r.get("date"):
            kept.append(r)
            continue
        dup = False
        for k in kept:
            if "hash" in k and k.get("date") and abs((k["date"] - r["date"]).total_seconds()) < minutes * 60:
                if bin(k["hash"] ^ r["hash"]).count("1") <= max_bits:
                    dup = True
                    k.setdefault("dupes", 0)
                    k["dupes"] += 1
                    break
        if not dup:
            kept.append(r)
    return kept


# ---------------------------------------------------------------- output
SHEET = """<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>pick the moments</title>
<style>
body{{background:#120405;color:#f3e3c3;font:15px/1.4 Georgia,serif;margin:0;padding:24px}}
h1{{font-style:italic;font-weight:300}} h2{{font:600 13px monospace;letter-spacing:4px;color:#e8a33d;margin:36px 0 10px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}}
.c{{position:relative;background:#000;border-radius:6px;overflow:hidden;cursor:pointer;outline:3px solid transparent}}
.c.on{{outline-color:#ff7a1a}} .c img{{width:100%;aspect-ratio:3/4;object-fit:cover;display:block;filter:sepia(.15)}}
.m{{position:absolute;left:0;right:0;bottom:0;padding:6px 8px;background:linear-gradient(transparent,rgba(0,0,0,.85));font:12px monospace}}
.b{{position:absolute;top:6px;left:6px;background:#ff7a1a;color:#000;font:700 11px monospace;padding:1px 6px;border-radius:9px}}
.bar{{position:sticky;top:0;background:#120405ee;padding:12px 0;z-index:2;display:flex;gap:12px;align-items:center;flex-wrap:wrap}}
button{{font:14px monospace;background:#f3e3c3;color:#2a080c;border:0;border-radius:99px;padding:8px 16px;cursor:pointer}}
</style>
<h1>{total} moments since {since}</h1>
<div class=bar><span id=n>0 picked</span><button onclick="exportPicks()">export picks.json</button>
<button onclick="autoPick()">auto-pick top 2 per month</button><span style="opacity:.6">tap to pick. picks play in date order.</span></div>
{months}
<script>
const DATA={data};
const on=new Set();
function t(el){{const i=+el.dataset.i;on.has(i)?on.delete(i):on.add(i);el.classList.toggle('on');document.getElementById('n').textContent=on.size+' picked'}}
function autoPick(){{const by={{}};DATA.forEach((d,i)=>{{(by[d.month]=by[d.month]||[]).push(i)}});
Object.values(by).forEach(a=>a.sort((x,y)=>DATA[y].score-DATA[x].score).slice(0,2).forEach(i=>{{if(!on.has(i)){{on.add(i);document.querySelector('[data-i="'+i+'"]').classList.add('on')}}}}));
document.getElementById('n').textContent=on.size+' picked'}}
function exportPicks(){{const picks=[...on].map(i=>DATA[i]).sort((a,b)=>a.date<b.date?-1:1).map(d=>({{path:d.path,type:d.type,date:d.date,t_in:d.t_in,t_out:d.t_out,caption:"",fx:d.type==='video'&&d.motion>0.08?'step':'' ,keepAudio:false}}));
const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(picks,null,2)],{{type:'application/json'}}));a.download='picks.json';a.click()}}
</script>"""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folders", nargs="+")
    ap.add_argument("--since", default="2024-11-12", help="ignore anything before this date (YYYY-MM-DD)")
    ap.add_argument("--out", default="./scan")
    ap.add_argument("--clip-len", type=float, default=3.0, help="seconds to take from each video")
    ap.add_argument("--step", type=float, default=0.5, help="seconds between sampled frames")
    ap.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    a = ap.parse_args()

    since = dt.datetime.strptime(a.since, "%Y-%m-%d")
    out = Path(a.out)
    (out / "thumbs").mkdir(parents=True, exist_ok=True)
    files = []
    for f in a.folders:
        for root, _, names in os.walk(os.path.expanduser(f)):
            for nm in names:
                ext = Path(nm).suffix.lower()
                if ext in VIDEO_EXT or ext in PHOTO_EXT:
                    if ext in {".heic", ".heif"} and not HEIF:
                        continue
                    files.append(os.path.join(root, nm))
    if not files:
        sys.exit("no photos/videos found")
    if not HEIF:
        print("note: pip install pillow-heif to include .HEIC photos", file=sys.stderr)
    print(f"scanning {len(files)} files with {a.workers} workers...")

    recs = []
    with ProcessPoolExecutor(max_workers=a.workers) as ex:
        futs = [ex.submit(analyze, f, str(out / "thumbs"), a.clip_len, a.step) for f in files]
        for i, fu in enumerate(as_completed(futs), 1):
            recs.append(fu.result())
            if i % 25 == 0 or i == len(files):
                print(f"  {i}/{len(files)}", end="\r")
    print()
    recs = [r for r in recs if r.get("date") and r["date"] >= since and "error" not in r]
    before = len(recs)
    recs = dedupe(recs)
    recs.sort(key=lambda r: r["date"])

    # stats for the gift page
    photos = sum(1 for r in recs if r["type"] == "photo")
    videos = len(recs) - photos
    months = sorted({r["date"].strftime("%Y-%m") for r in recs})
    print(f"\n{before} files since {a.since} ({before - len(recs)} near-duplicates removed)")
    print(f"  photos: {photos}   videos: {videos}   months with memories: {len(months)}")
    print(f"  with both of you in frame (2+ faces): {sum(1 for r in recs if r.get('faces', 0) >= 2)}")
    print(f"  with someone smiling: {sum(1 for r in recs if r.get('smiles', 0) > 0)}")

    data = []
    for r in recs:
        r2 = {k: v for k, v in r.items() if k != "hash"}
        r2["date"] = r["date"].isoformat(timespec="seconds")
        r2["month"] = r["date"].strftime("%Y-%m")
        r2["score"] = round(r["score"], 3)
        data.append(r2)
    (out / "library.json").write_text(json.dumps(data, indent=1))

    sections = []
    by_month = {}
    for i, d in enumerate(data):
        by_month.setdefault(d["month"], []).append((i, d))
    for mo, items in by_month.items():
        items.sort(key=lambda x: -x[1]["score"])
        cards = []
        for i, d in items:
            badge = f'<span class=b>{"&#9654; " + str(round(d.get("t_out", 0) - d.get("t_in", 0), 1)) + "s" if d["type"] == "video" else ""} {int(d["score"] * 100)}</span>'
            cards.append(
                f'<div class=c data-i={i} onclick="t(this)">{badge}<img loading=lazy src="{html.escape(d.get("thumb", ""))}">'
                f'<div class=m>{d["date"][:10]} &middot; {d.get("faces", 0)} faces</div></div>'
            )
        label = dt.datetime.strptime(mo, "%Y-%m").strftime("%B %Y").upper()
        sections.append(f"<h2>{label}</h2><div class=grid>{''.join(cards)}</div>")
    (out / "index.html").write_text(
        SHEET.format(total=len(data), since=a.since, months="".join(sections), data=json.dumps(data).replace("</", "<\\/"))
    )
    print(f"\nopen {out / 'index.html'} to pick your moments")


if __name__ == "__main__":
    main()
