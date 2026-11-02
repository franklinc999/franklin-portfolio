#!/usr/bin/env python3
"""
build_film.py: turn picks.json into a dreamy 2000s-film / Wong Kar-wai style edit.

Look, per clip:
  * warm highlights, teal-green shadows, lifted blacks (In the Mood for Love / Chungking palette)
  * red halation bloom around highlights
  * step-printing smear on clips with fx="step" (the Chungking Express / Fallen Angels motion blur)
  * Ken Burns drift on photos
  * subtle gate weave, film grain, vignette
  * orange digicam date stamp ('24 11 12) from the clip's real date
  * yellow serif subtitles for captions (the classic WKW subtitle look)
Then crossfades every clip, adds title + end cards, lays music under it, and ducks the
music under any clip with keepAudio=true (her laugh, a voice note, etc).

Usage:
  python3 build_film.py picks.json --music song.mp3 --out film.mp4
  python3 build_film.py picks.json --aspect 4:5 --title "11 . 12" --end "to year three"
picks.json is exported from scan_library.py's contact sheet; edit it to reorder clips,
add captions (lines from your letter work beautifully), or set fx/keepAudio per clip.
"""
import argparse
import datetime as dt
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

FPS = 24
ASPECTS = {"9:16": (1080, 1920), "4:5": (1080, 1350), "1:1": (1080, 1080), "16:9": (1920, 1080), "4:3": (1440, 1080)}
FONT_CANDIDATES = {
    "stamp": [
        "VT323-Regular.ttf",
        "/System/Library/Fonts/Menlo.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    ],
    "serif": [
        "CormorantGaramond-Italic.ttf",
        "/System/Library/Fonts/Supplemental/Georgia Italic.ttf",
        "/Library/Fonts/Georgia Italic.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    ],
}


def find_font(kind, override=None):
    here = Path(__file__).parent
    for c in ([override] if override else []) + FONT_CANDIDATES[kind]:
        for p in (Path(c), here / "fonts" / c):
            if p.exists():
                return str(p)
    return None


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(" ".join(cmd) + "\n" + r.stderr[-3000:] + "\n")
        raise SystemExit(f"ffmpeg failed ({r.returncode})")


def esc_path(p):
    """escape a path for use inside an ffmpeg filter option"""
    return p.replace("\\", "/").replace(":", "\\:").replace("'", "\\'")


def stamp_text(date_str):
    try:
        d = dt.datetime.fromisoformat(date_str)
    except Exception:
        return None
    return f"'{d:%y} {d.month:>2} {d.day:>2}"


def look_chain(W, H, i, fx, stamp, caption_file, fonts, grain, strength, lut=None):
    """the shared grade + texture chain applied after scaling to WxH"""
    f = []
    if lut:
        f.append(f"lut3d=file='{esc_path(lut)}':interp=tetrahedral")
    if fx == "step":
        # step-print: drop to 8fps, hold frames, then smear neighbours together
        f += [f"fps=8", f"fps={FPS}", "tmix=frames=4:weights='1 2 3 4'"]
    k = strength
    f += [
        # palette: lift blacks, push greens into shadows, amber into highlights
        # gently lifted, green-leaning blacks; creamy amber highlights; restrained magenta
        f"curves=r='0/0.02 0.5/{0.5 + 0.015 * k:.3f} 1/0.98':g='0/0.045 0.5/{0.5 + 0.015 * k:.3f} 1/0.97':b='0/0.04 0.5/{0.5 - 0.05 * k:.3f} 1/0.88'",
        f"colorbalance=rs={-0.05 * k:.3f}:gs={0.04 * k:.3f}:bs={0.01 * k:.3f}:rm={-0.01 * k:.3f}:gm={0.015 * k:.3f}:rh={0.02 * k:.3f}:gh={0.025 * k:.3f}:bh={-0.05 * k:.3f}",
        f"eq=saturation={1 + 0.08 * k:.3f}:contrast={1 + 0.1 * k:.3f}:gamma=0.98",
    ]
    chain = ",".join(f)
    # halation: blur only the brights, tint red, screen it back on
    hal = (
        f"format=gbrp,split[base{i}][hi{i}];[hi{i}]curves=all='0/0 0.9/0 1/1',gblur=sigma={W / 50:.1f},"
        f"colorchannelmixer=rr=1:gg=0.42:bb=0.15[h{i}];[base{i}][h{i}]blend=all_mode=screen:all_opacity={0.35 * k:.2f},format=yuv420p"
    )
    weave = (
        f"scale={int(W * 1.02) // 2 * 2}:{int(H * 1.02) // 2 * 2},"
        f"crop={W}:{H}:x='(iw-ow)/2+2*sin(n/7)':y='(ih-oh)/2+1.5*sin(n/5+1)'"
    )
    tex = f"noise=alls={grain}:allf=t+u,vignette=angle=PI/4.6"
    tail = [weave, tex]
    if stamp and fonts["stamp"]:
        fs = int(H * 0.028)
        tail.append(
            f"drawtext=fontfile='{esc_path(fonts['stamp'])}':text='{stamp.replace(chr(39), '’')}':"
            f"fontcolor=0xff7a1a:fontsize={fs}:x=w-tw-{int(W * 0.06)}:y=h-th-{int(H * 0.05)}:"
            f"shadowcolor=0xff5000@0.6:shadowx=0:shadowy=0:borderw=1:bordercolor=0xff9a3a@0.35"
        )
    if caption_file and fonts["serif"]:
        fs = int(H * 0.032)
        tail.append(
            f"drawtext=fontfile='{esc_path(fonts['serif'])}':textfile='{esc_path(caption_file)}':"
            f"fontcolor=0xf6d24a:fontsize={fs}:x=(w-tw)/2:y=h-th-{int(H * 0.13)}:"
            f"shadowcolor=black@0.85:shadowx=2:shadowy=2:line_spacing={int(fs * 0.3)}:"
            f"alpha='if(lt(t,0.4),t/0.4,1)'"
        )
    return chain, hal, ",".join(tail)


def render_clip(i, c, W, H, tmp, fonts, a):
    out = os.path.join(tmp, f"seg{i:03d}.mp4")
    path = os.path.expanduser(c["path"])
    fit = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1"
    cap = None
    if c.get("caption"):
        cap = os.path.join(tmp, f"cap{i:03d}.txt")
        Path(cap).write_text(c["caption"])
    stamp = stamp_text(c.get("date", "")) if a.stamp else None
    chain, hal, tail = look_chain(W, H, i, c.get("fx", ""), stamp, cap, fonts, a.grain, a.strength, a.lut)

    if c["type"] == "photo":
        dur = float(c.get("_planned") or c.get("duration", a.photo_len))
        frames = int(dur * FPS)
        # slow push in, alternating direction, rendered at 2x then downscaled to avoid zoompan jitter
        zin = i % 2 == 0
        z = f"'min(1+0.0009*on,1.12)'" if zin else f"'max(1.12-0.0009*on,1)'"
        pre = (
            f"scale={W * 2}:{H * 2}:force_original_aspect_ratio=increase,crop={W * 2}:{H * 2},"
            f"zoompan=z={z}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={W}x{H}:fps={FPS},setsar=1"
        )
        inputs = ["-loop", "1", "-t", f"{dur}", "-i", path]
        audio = ["-f", "lavfi", "-t", f"{dur}", "-i", "anullsrc=r=48000:cl=stereo"]
        vf = f"[0:v]{pre},{chain},{hal},{tail},format=yuv420p,trim=duration={dur}[v]"
        amap = "1:a"
    else:
        t_in = float(c.get("t_in", 0) or 0)
        t_out = float(c.get("t_out", t_in + 3) or t_in + 3)
        dur = max(0.5, t_out - t_in)
        if c.get("_planned"):
            src_len = float((probe(path).get("format") or {}).get("duration") or 0) or (t_in + dur)
            speed0 = float(c.get("speed", 1.0))
            dur = c["_planned"] * speed0  # source seconds needed
            if t_in + dur > src_len:  # not enough footage after t_in: slide the window back
                t_in = max(0.0, src_len - dur)
                dur = min(dur, src_len - t_in)
        inputs = ["-ss", f"{t_in}", "-t", f"{dur}", "-i", path]
        audio = ["-f", "lavfi", "-t", f"{dur}", "-i", "anullsrc=r=48000:cl=stereo"]
        speed = float(c.get("speed", 1.0))
        slow = f",setpts={1 / speed:.3f}*PTS" if speed != 1.0 else ""
        if speed != 1.0:
            dur = dur / speed
        vf = f"[0:v]fps={FPS}{slow},{fit},{chain},{hal},{tail},format=yuv420p,trim=duration={dur}[v]"
        has_audio = any(s.get("codec_type") == "audio" for s in probe(path).get("streams", []))
        amap = "0:a" if (c.get("keepAudio") and has_audio and speed == 1.0) else "1:a"

    run(
        ["ffmpeg", "-y", "-v", "error", *inputs, *audio, "-filter_complex", vf, "-map", "[v]", "-map", amap,
         "-t", f"{dur}", "-c:v", "libx264", "-preset", a.preset, "-crf", "17", "-r", str(FPS),
         "-c:a", "aac", "-ar", "48000", "-ac", "2", out]
    )
    return out, dur


def card(i, text, sub, dur, W, H, tmp, fonts, a):
    out = os.path.join(tmp, f"card{i}.mp4")
    tf = os.path.join(tmp, f"card{i}.txt")
    Path(tf).write_text(text)
    parts = [f"color=c=0x120405:s={W}x{H}:d={dur}:r={FPS}"]
    if fonts["serif"]:
        parts.append(
            f"drawtext=fontfile='{esc_path(fonts['serif'])}':textfile='{esc_path(tf)}':fontcolor=0xf3e3c3:"
            f"fontsize={int(H * 0.05)}:x=(w-tw)/2:y=(h-th)/2:alpha='min(1,t/1.2)*min(1,({dur}-t)/0.8)'"
        )
    if sub and fonts["stamp"]:
        sf = os.path.join(tmp, f"card{i}s.txt")
        Path(sf).write_text(sub)
        parts.append(
            f"drawtext=fontfile='{esc_path(fonts['stamp'])}':textfile='{esc_path(sf)}':fontcolor=0xff7a1a:"
            f"fontsize={int(H * 0.026)}:x=(w-tw)/2:y=h*0.62:alpha='min(1,max(0,t-0.8)/1)*min(1,({dur}-t)/0.8)'"
        )
    parts += [f"noise=alls={a.grain + 4}:allf=t+u", "vignette=angle=PI/4", "format=yuv420p"]
    run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", ",".join(parts), "-f", "lavfi", "-t", f"{dur}",
         "-i", "anullsrc=r=48000:cl=stereo", "-t", f"{dur}", "-c:v", "libx264", "-preset", a.preset, "-crf", "17",
         "-c:a", "aac", "-ar", "48000", "-ac", "2", out])
    return out, dur


def beat_grid(music, every):
    """Cut points from the song. Prefers Beat This! (downbeats), falls back to librosa."""
    try:
        from beat_this.inference import File2Beats  # pip install beat-this

        beats, downbeats = File2Beats(checkpoint_path="final0", device="cpu", dbn=False)(music)
        grid = list(downbeats) if every == 4 and len(downbeats) > 4 else list(beats)[::every]
        print(f"  beat grid from Beat This!: {len(grid)} cut points")
        return [float(x) for x in grid]
    except Exception:
        pass
    try:
        import librosa

        y, sr = librosa.load(music, sr=22050, mono=True)
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
        grid = [float(x) for x in list(beats)[::every]]
        bpm = float(tempo[0]) if hasattr(tempo, "__len__") else float(tempo)
        print(f"  beat grid from librosa (~{bpm:.0f} bpm): {len(grid)} cut points")
        return grid
    except Exception as e:
        print(f"  (no beat sync: {e}; pip install librosa)", file=sys.stderr)
        return []


def plan_durations(picks, grid, xf, title_len, min_len, max_len):
    """Give each clip a duration so every cut lands on the beat grid."""
    if not grid:
        return None
    t = title_len - xf  # start of first clip on the output timeline
    out = []
    for c in picks:
        want = c.get("duration") or (float(c.get("t_out", 3)) - float(c.get("t_in", 0)) if c["type"] == "video" else None) or 3.0
        target = t + max(min_len, min(max_len, want))
        nxt = min((g for g in grid if g >= t + min_len), key=lambda g: abs(g - target), default=None)
        d = (nxt - t) if nxt and nxt - t <= max_len + 1 else max(min_len, min(max_len, want))
        out.append(d + xf)
        t += d
    return out


def probe(path):
    try:
        return json.loads(subprocess.run(["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams",
                                          "-show_format", path], capture_output=True, text=True).stdout or "{}")
    except Exception:
        return {}


def join(segs, keep, xf, music, out, a):
    """crossfade all segments, then lay music underneath with ducking where keepAudio clips play."""
    inputs = []
    for p, _ in segs:
        inputs += ["-i", p]
    fc = []
    # video crossfades
    offset = 0.0
    last_v = "0:v"
    last_a = "0:a"
    for k in range(1, len(segs)):
        offset += segs[k - 1][1] - xf
        fc.append(f"[{last_v}][{k}:v]xfade=transition=fade:duration={xf}:offset={offset:.3f}[v{k}]")
        fc.append(f"[{last_a}][{k}:a]acrossfade=d={xf}[a{k}]")
        last_v, last_a = f"v{k}", f"a{k}"
    total = sum(d for _, d in segs) - xf * (len(segs) - 1)
    vlabel = f"[{last_v}]" if len(segs) > 1 else "[0:v]"
    alabel = f"[{last_a}]" if len(segs) > 1 else "[0:a]"
    if music:
        mi = len(segs)
        inputs += ["-stream_loop", "-1", "-i", music]
        # duck music to 20% inside windows where the clip's own sound plays
        starts, t = [], 0.0
        for idx, (_, d) in enumerate(segs):
            if keep[idx]:
                starts.append((t, t + d))
            t += d - xf
        duck = "".join(f",volume=enable='between(t,{s0:.2f},{s1:.2f})':volume=0.2" for s0, s1 in starts)
        fc.append(
            f"[{mi}:a]atrim=0:{total:.3f},asetpts=PTS-STARTPTS,volume={a.music_volume}{duck},"
            f"afade=t=in:d=1.5,afade=t=out:st={max(0, total - 3):.3f}:d=3[m]"
        )
        fc.append(f"{alabel}[m]amix=inputs=2:duration=first:normalize=0[aout]")
        alabel = "[aout]"
    run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(fc) if fc else "anull",
         "-map", vlabel, "-map", alabel, "-t", f"{total:.3f}", "-c:v", "libx264", "-preset", a.preset,
         "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "192k", out])
    return total


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("picks")
    ap.add_argument("--out", default="film.mp4")
    ap.add_argument("--music")
    ap.add_argument("--music-volume", type=float, default=0.9)
    ap.add_argument("--aspect", default="9:16", choices=list(ASPECTS))
    ap.add_argument("--photo-len", type=float, default=3.0)
    ap.add_argument("--xfade", type=float, default=0.5, help="crossfade seconds")
    ap.add_argument("--grain", type=int, default=12)
    ap.add_argument("--strength", type=float, default=1.0, help="grade strength, 0 = natural, 1.5 = heavy")
    ap.add_argument("--no-stamp", dest="stamp", action="store_false")
    ap.add_argument("--title", default="11 . 12")
    ap.add_argument("--title-sub", default="a film about us")
    ap.add_argument("--end", default="to year three")
    ap.add_argument("--stamp-font")
    ap.add_argument("--serif-font")
    ap.add_argument("--lut", help=".cube film LUT, e.g. CineStill 800T (applied before the grade)")
    ap.add_argument("--beats", type=int, default=4, help="cut every N beats (4 = every bar); 0 disables beat sync")
    ap.add_argument("--preset", default="medium", help="x264 preset (ultrafast for drafts)")
    ap.add_argument("--poster", help="also save a poster jpg (e.g. film-poster.jpg)")
    a = ap.parse_args()

    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found (brew install ffmpeg)")
    picks = json.loads(Path(a.picks).read_text())
    if not picks:
        sys.exit("picks.json is empty")
    W, H = ASPECTS[a.aspect]
    fonts = {"stamp": find_font("stamp", a.stamp_font), "serif": find_font("serif", a.serif_font)}
    if not fonts["stamp"] or not fonts["serif"]:
        print("warning: font not found, pass --stamp-font / --serif-font. Missing:",
              [k for k, v in fonts.items() if not v], file=sys.stderr)

    title_len = 3.5
    if a.music and a.beats:
        grid = beat_grid(a.music, a.beats)
        if grid and a.title:
            # end the title card on the first bar after 3s so the first clip lands on a downbeat
            first = min((g for g in grid if g >= 3.0), default=None)
            if first and first < 6:
                title_len = first + a.xfade
        plan = plan_durations(picks, grid, a.xfade, title_len if a.title else a.xfade, 1.2, 4.5)
        if plan:
            for c, d in zip(picks, plan):
                c["_planned"] = round(d, 3)

    tmp = tempfile.mkdtemp(prefix="film_")
    segs, keep = [], []
    try:
        if a.title:
            segs.append(card(0, a.title, a.title_sub, title_len, W, H, tmp, fonts, a))
            keep.append(False)
        for i, c in enumerate(picks):
            print(f"  [{i + 1}/{len(picks)}] {Path(c['path']).name}")
            segs.append(render_clip(i, c, W, H, tmp, fonts, a))
            keep.append(bool(c.get("keepAudio")))
        if a.end:
            segs.append(card(1, a.end, None, 4.0, W, H, tmp, fonts, a))
            keep.append(False)
        print("  joining...")
        total = join(segs, keep, a.xfade, a.music, a.out, a)
        print(f"done: {a.out} ({total:.1f}s, {W}x{H})")
        if a.poster:
            run(["ffmpeg", "-y", "-v", "error", "-ss", f"{min(total / 3, 8):.2f}", "-i", a.out, "-frames:v", "1",
                 "-q:v", "3", a.poster])
            print(f"poster: {a.poster}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
