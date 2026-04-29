"use client";

/**
 * SIGNAL // NOISE
 * A twin-stick shooter where sound IS the gameplay.
 * Tune your weapon to enemy frequencies. Reveal what's hidden in the noise.
 *
 * Design: Franklin Cheng + Computer (2026)
 */

import { useEffect, useRef, useState } from "react";

type Band = 0 | 1 | 2; // 0 = low/cyan, 1 = mid/violet, 2 = high/amber

const BAND_COLORS = [
  { core: "#5bb8d4", glow: "rgba(91,184,212,1)", soft: "rgba(91,184,212,0.35)", name: "LOW" },
  { core: "#a78bfa", glow: "rgba(167,139,250,1)", soft: "rgba(167,139,250,0.35)", name: "MID" },
  { core: "#f5b942", glow: "rgba(245,185,66,1)", soft: "rgba(245,185,66,0.35)", name: "HIGH" },
] as const;

const BAND_FREQ = [180, 440, 880]; // Hz for audio tones

interface Vec { x: number; y: number; }

interface Enemy {
  pos: Vec;
  vel: Vec;
  band: Band;
  hp: number;
  maxHp: number;
  radius: number;
  pulsePhase: number; // 0..1, visibility cycles with this
  pulseSpeed: number;
  type: "stalker" | "drifter" | "scrambler";
  age: number;
}

interface Bullet {
  pos: Vec;
  vel: Vec;
  band: Band;
  life: number;
}

interface Particle {
  pos: Vec;
  vel: Vec;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface FloatText {
  pos: Vec;
  text: string;
  color: string;
  life: number;
  vy: number;
}

interface GameState {
  status: "menu" | "playing" | "gameover";
  player: { pos: Vec; vel: Vec; hp: number; maxHp: number; band: Band; iframes: number; };
  enemies: Enemy[];
  bullets: Bullet[];
  particles: Particle[];
  floatText: FloatText[];
  score: number;
  multiplier: number;
  multiplierTimer: number;
  lastBandKilled: Band | -1;
  chain: number;
  wave: number;
  waveTimer: number;
  enemiesThisWave: number;
  spawnTimer: number;
  shootCooldown: number;
  shake: number;
  hitstop: number;
  scrambled: number;
  time: number;
  best: number;
}

const W = 960;
const H = 600;
const PLAYER_R = 12;
const PLAYER_SPEED = 240;
const BULLET_SPEED = 720;
const SHOOT_CD = 0.13;

function dist(a: Vec, b: Vec) { return Math.hypot(a.x - b.x, a.y - b.y); }
function len(v: Vec) { return Math.hypot(v.x, v.y); }
function norm(v: Vec): Vec { const l = len(v) || 1; return { x: v.x / l, y: v.y / l }; }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function rand(min: number, max: number) { return min + Math.random() * (max - min); }

function makeInitialState(best: number): GameState {
  return {
    status: "menu",
    player: { pos: { x: W / 2, y: H / 2 }, vel: { x: 0, y: 0 }, hp: 3, maxHp: 3, band: 0, iframes: 0 },
    enemies: [],
    bullets: [],
    particles: [],
    floatText: [],
    score: 0,
    multiplier: 1,
    multiplierTimer: 0,
    lastBandKilled: -1,
    chain: 0,
    wave: 1,
    waveTimer: 0,
    enemiesThisWave: 0,
    spawnTimer: 0,
    shootCooldown: 0,
    shake: 0,
    hitstop: 0,
    scrambled: 0,
    time: 0,
    best,
  };
}

export default function SignalNoiseGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, forceRender] = useState(0);
  const stateRef = useRef<GameState>(makeInitialState(0));
  const keysRef = useRef<Record<string, boolean>>({});
  const mouseRef = useRef<{ x: number; y: number; down: boolean }>({ x: W / 2, y: H / 2, down: false });
  const audioRef = useRef<AudioContext | null>(null);

  // Initial best score from localStorage
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("signal-noise-best") : null;
    if (stored) {
      stateRef.current.best = parseInt(stored, 10) || 0;
      forceRender((n) => n + 1);
    }
  }, []);

  // Input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
      const s = stateRef.current;
      // Tune with 1/2/3 or Q/E
      if (e.key === "1") s.player.band = 0;
      if (e.key === "2") s.player.band = 1;
      if (e.key === "3") s.player.band = 2;
      if (e.key.toLowerCase() === "q") s.player.band = ((s.player.band + 2) % 3) as Band;
      if (e.key.toLowerCase() === "e") s.player.band = ((s.player.band + 1) % 3) as Band;
      if (e.key === " " && (s.status === "menu" || s.status === "gameover")) {
        e.preventDefault();
        startGame();
      }
      if (["w", "a", "s", "d", " ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key.toLowerCase()] = false; };
    const onWheel = (e: WheelEvent) => {
      const s = stateRef.current;
      if (s.status !== "playing") return;
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      s.player.band = (((s.player.band + dir) % 3) + 3) % 3 as Band;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    const canvas = canvasRef.current;
    canvas?.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas?.removeEventListener("wheel", onWheel);
    };
  }, []);

  // Mouse on canvas
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const onMove = (e: MouseEvent) => {
      const rect = c.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * W;
      mouseRef.current.y = ((e.clientY - rect.top) / rect.height) * H;
    };
    const onDown = () => { mouseRef.current.down = true; ensureAudio(); };
    const onUp = () => { mouseRef.current.down = false; };
    c.addEventListener("mousemove", onMove);
    c.addEventListener("mousedown", onDown);
    c.addEventListener("mouseup", onUp);
    c.addEventListener("mouseleave", onUp);
    return () => {
      c.removeEventListener("mousemove", onMove);
      c.removeEventListener("mousedown", onDown);
      c.removeEventListener("mouseup", onUp);
      c.removeEventListener("mouseleave", onUp);
    };
  }, []);

  // Game loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      update(dt);
      render();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ensureAudio() {
    if (!audioRef.current && typeof window !== "undefined") {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioRef.current = new AC();
      } catch { /* noop */ }
    }
    if (audioRef.current?.state === "suspended") audioRef.current.resume();
  }

  function beep(freq: number, dur = 0.06, type: OscillatorType = "square", vol = 0.05) {
    const ctx = audioRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  function startGame() {
    const best = stateRef.current.best;
    stateRef.current = makeInitialState(best);
    stateRef.current.status = "playing";
    ensureAudio();
    forceRender((n) => n + 1);
  }

  function spawnEnemy(s: GameState) {
    // Spawn off-edge
    const side = Math.floor(Math.random() * 4);
    const margin = 40;
    let pos: Vec;
    if (side === 0) pos = { x: rand(0, W), y: -margin };
    else if (side === 1) pos = { x: W + margin, y: rand(0, H) };
    else if (side === 2) pos = { x: rand(0, W), y: H + margin };
    else pos = { x: -margin, y: rand(0, H) };

    const wave = s.wave;
    const r = Math.random();
    let type: Enemy["type"];
    if (wave >= 3 && r < 0.15) type = "scrambler";
    else if (r < 0.55) type = "drifter";
    else type = "stalker";

    const band = Math.floor(Math.random() * 3) as Band;
    const speedMul = 1 + (wave - 1) * 0.06;
    const baseSpeed = type === "stalker" ? 80 : type === "drifter" ? 55 : 100;
    const hp = type === "scrambler" ? 4 : type === "stalker" ? 3 : 2;

    s.enemies.push({
      pos,
      vel: { x: 0, y: 0 },
      band,
      hp,
      maxHp: hp,
      radius: type === "scrambler" ? 16 : 14,
      pulsePhase: Math.random(),
      pulseSpeed: type === "drifter" ? 0.45 : type === "stalker" ? 0.7 : 0.55,
      type,
      age: 0,
    });
    // baseSpeed and speedMul are seeded for telemetry/future tuning
    void (baseSpeed * speedMul);
  }

  function emitParticles(s: GameState, pos: Vec, color: string, count: number, speed = 200) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rand(speed * 0.3, speed);
      s.particles.push({
        pos: { x: pos.x, y: pos.y },
        vel: { x: Math.cos(a) * v, y: Math.sin(a) * v },
        life: rand(0.3, 0.7),
        maxLife: 0.7,
        color,
        size: rand(1.5, 3.5),
      });
    }
  }

  function update(dt: number) {
    const s = stateRef.current;
    if (s.status !== "playing") {
      // Still update particles a bit on menu for ambient feel
      s.particles.forEach((p) => {
        p.pos.x += p.vel.x * dt;
        p.pos.y += p.vel.y * dt;
        p.life -= dt;
      });
      s.particles = s.particles.filter((p) => p.life > 0);
      s.shake *= 0.9;
      return;
    }

    if (s.hitstop > 0) {
      s.hitstop -= dt;
      return;
    }

    s.time += dt;

    // --- Player movement ---
    const k = keysRef.current;
    const move: Vec = { x: 0, y: 0 };
    if (k["w"] || k["arrowup"]) move.y -= 1;
    if (k["s"] || k["arrowdown"]) move.y += 1;
    if (k["a"] || k["arrowleft"]) move.x -= 1;
    if (k["d"] || k["arrowright"]) move.x += 1;
    const m = norm(move);
    s.player.vel.x = lerp(s.player.vel.x, m.x * PLAYER_SPEED, 0.2);
    s.player.vel.y = lerp(s.player.vel.y, m.y * PLAYER_SPEED, 0.2);
    s.player.pos.x = Math.max(PLAYER_R, Math.min(W - PLAYER_R, s.player.pos.x + s.player.vel.x * dt));
    s.player.pos.y = Math.max(PLAYER_R, Math.min(H - PLAYER_R, s.player.pos.y + s.player.vel.y * dt));
    if (s.player.iframes > 0) s.player.iframes -= dt;

    // --- Shooting ---
    s.shootCooldown -= dt;
    if (mouseRef.current.down && s.shootCooldown <= 0) {
      s.shootCooldown = SHOOT_CD;
      const dir = norm({ x: mouseRef.current.x - s.player.pos.x, y: mouseRef.current.y - s.player.pos.y });
      s.bullets.push({
        pos: { x: s.player.pos.x + dir.x * 18, y: s.player.pos.y + dir.y * 18 },
        vel: { x: dir.x * BULLET_SPEED, y: dir.y * BULLET_SPEED },
        band: s.player.band,
        life: 0.9,
      });
      beep(BAND_FREQ[s.player.band] * 2, 0.03, "square", 0.025);
    }

    // --- Wave / spawn logic ---
    const targetEnemies = Math.min(4 + s.wave * 2, 18);
    s.spawnTimer -= dt;
    if (s.enemies.length < targetEnemies && s.spawnTimer <= 0) {
      spawnEnemy(s);
      s.spawnTimer = Math.max(0.35, 1.0 - s.wave * 0.05);
    }
    s.waveTimer += dt;
    // Wave duration ~ 22-28s, gets longer slightly
    if (s.waveTimer > 22 + s.wave * 1.5) {
      s.wave++;
      s.waveTimer = 0;
      s.floatText.push({ pos: { x: W / 2, y: H / 2 - 60 }, text: `WAVE ${s.wave}`, color: "#e8e8ec", life: 2, vy: -8 });
      beep(220, 0.18, "sawtooth", 0.04);
      setTimeout(() => beep(330, 0.18, "sawtooth", 0.04), 160);
    }

    // --- Enemies ---
    for (const e of s.enemies) {
      e.age += dt;
      e.pulsePhase = (e.pulsePhase + dt * e.pulseSpeed) % 1;

      const speedMul = 1 + (s.wave - 1) * 0.06;
      const dir = norm({ x: s.player.pos.x - e.pos.x, y: s.player.pos.y - e.pos.y });

      if (e.type === "stalker") {
        e.vel.x = lerp(e.vel.x, dir.x * 95 * speedMul, 0.06);
        e.vel.y = lerp(e.vel.y, dir.y * 95 * speedMul, 0.06);
      } else if (e.type === "drifter") {
        // weave around player
        const perp = { x: -dir.y, y: dir.x };
        const wob = Math.sin(e.age * 1.5);
        e.vel.x = lerp(e.vel.x, (dir.x * 50 + perp.x * wob * 60) * speedMul, 0.05);
        e.vel.y = lerp(e.vel.y, (dir.y * 50 + perp.y * wob * 60) * speedMul, 0.05);
      } else {
        // scrambler: orbits at distance, pulses scramble
        const d = dist(e.pos, s.player.pos);
        const target = 220;
        const radial = (d - target) * 0.5;
        const perp = { x: -dir.y, y: dir.x };
        e.vel.x = lerp(e.vel.x, (dir.x * radial + perp.x * 80) * speedMul * 0.7, 0.06);
        e.vel.y = lerp(e.vel.y, (dir.y * radial + perp.y * 80) * speedMul * 0.7, 0.06);
        // Scrambler emits scramble pulse on full pulse
        if (e.pulsePhase > 0.95 && e.pulsePhase - dt * e.pulseSpeed <= 0.95) {
          if (d < 320) s.scrambled = Math.min(s.scrambled + 1.5, 3);
        }
      }

      e.pos.x += e.vel.x * dt;
      e.pos.y += e.vel.y * dt;

      // Damage player on contact
      if (s.player.iframes <= 0 && dist(e.pos, s.player.pos) < e.radius + PLAYER_R - 2) {
        s.player.hp -= 1;
        s.player.iframes = 1.0;
        s.shake = 18;
        s.hitstop = 0.08;
        s.chain = 0;
        s.multiplier = 1;
        emitParticles(s, s.player.pos, "#ff5577", 30, 280);
        beep(110, 0.2, "sawtooth", 0.07);
        if (s.player.hp <= 0) {
          s.status = "gameover";
          if (s.score > s.best) {
            s.best = s.score;
            try { localStorage.setItem("signal-noise-best", String(s.score)); } catch { /* ignore */ }
          }
          forceRender((n) => n + 1);
        }
      }
    }

    // --- Bullets ---
    for (const b of s.bullets) {
      b.pos.x += b.vel.x * dt;
      b.pos.y += b.vel.y * dt;
      b.life -= dt;
    }
    // Bullet-enemy collisions
    for (const b of s.bullets) {
      if (b.life <= 0) continue;
      for (const e of s.enemies) {
        if (e.hp <= 0) continue;
        if (dist(b.pos, e.pos) < e.radius + 4) {
          const matched = b.band === e.band;
          const dmg = matched ? 3 : 0.4;
          e.hp -= dmg;
          b.life = 0;
          const c = BAND_COLORS[b.band];
          emitParticles(s, b.pos, c.core, matched ? 14 : 5, matched ? 320 : 160);
          if (matched) beep(BAND_FREQ[b.band] * 1.5, 0.05, "triangle", 0.04);
          if (e.hp <= 0) {
            // KILL
            const killColor = BAND_COLORS[e.band].core;
            emitParticles(s, e.pos, killColor, 26, 360);
            s.shake = Math.max(s.shake, 8);
            s.hitstop = Math.max(s.hitstop, 0.04);
            // chain / multiplier
            if (s.lastBandKilled === e.band) s.chain++;
            else s.chain = 1;
            s.lastBandKilled = e.band;
            s.multiplier = Math.min(1 + Math.floor(s.chain / 3), 6);
            s.multiplierTimer = 4;
            const points = (e.type === "scrambler" ? 250 : e.type === "stalker" ? 100 : 70) * s.multiplier;
            s.score += points;
            s.floatText.push({
              pos: { x: e.pos.x, y: e.pos.y },
              text: `+${points}${s.multiplier > 1 ? ` ×${s.multiplier}` : ""}`,
              color: killColor,
              life: 0.9,
              vy: -40,
            });
            beep(BAND_FREQ[e.band], 0.12, "triangle", 0.05);
          }
          break;
        }
      }
    }
    s.bullets = s.bullets.filter((b) => b.life > 0 && b.pos.x > -50 && b.pos.x < W + 50 && b.pos.y > -50 && b.pos.y < H + 50);
    s.enemies = s.enemies.filter((e) => e.hp > 0 && e.pos.x > -200 && e.pos.x < W + 200 && e.pos.y > -200 && e.pos.y < H + 200);

    // multiplier decay
    if (s.multiplier > 1) {
      s.multiplierTimer -= dt;
      if (s.multiplierTimer <= 0) {
        s.multiplier = 1;
        s.chain = 0;
      }
    }

    // particles + float text
    for (const p of s.particles) {
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.vel.x *= 0.94;
      p.vel.y *= 0.94;
      p.life -= dt;
    }
    s.particles = s.particles.filter((p) => p.life > 0);
    for (const f of s.floatText) {
      f.pos.y += f.vy * dt;
      f.life -= dt;
    }
    s.floatText = s.floatText.filter((f) => f.life > 0);

    s.shake *= Math.pow(0.0001, dt);
    s.scrambled = Math.max(0, s.scrambled - dt * 0.6);
  }

  function render() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;

    // Resize for DPR once
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== W * dpr) {
      c.width = W * dpr;
      c.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Background
    ctx.fillStyle = "#0a0a0c";
    ctx.fillRect(0, 0, W, H);

    // shake
    ctx.save();
    if (s.shake > 0.5) {
      ctx.translate(rand(-s.shake, s.shake), rand(-s.shake, s.shake));
    }

    // Subtle radar grid
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    const grid = 32;
    for (let x = 0; x < W; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Vignette + scanlines
    const vg = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 600);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // --- Particles ---
    for (const p of s.particles) {
      const alpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // --- Enemies (visible only on pulse) ---
    for (const e of s.enemies) {
      const c0 = BAND_COLORS[e.band];
      // Pulse curve: peaks briefly then fades
      const pulse = Math.max(0, Math.sin(e.pulsePhase * Math.PI * 2));
      const visibility = Math.pow(pulse, 1.6);

      // Faint silhouette always (so you can sort of see them in motion)
      ctx.globalAlpha = 0.08 + visibility * 0.0;
      ctx.strokeStyle = c0.core;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, e.radius, 0, Math.PI * 2);
      ctx.stroke();

      if (visibility > 0.05) {
        // outer glow
        const grad = ctx.createRadialGradient(e.pos.x, e.pos.y, 0, e.pos.x, e.pos.y, e.radius * 4);
        grad.addColorStop(0, c0.soft);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = visibility * 0.7;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(e.pos.x, e.pos.y, e.radius * 4, 0, Math.PI * 2);
        ctx.fill();

        // body
        ctx.globalAlpha = visibility;
        ctx.fillStyle = c0.core;
        ctx.beginPath();
        if (e.type === "stalker") {
          // triangle pointing toward player
          const ang = Math.atan2(s.player.pos.y - e.pos.y, s.player.pos.x - e.pos.x);
          ctx.save();
          ctx.translate(e.pos.x, e.pos.y);
          ctx.rotate(ang);
          ctx.beginPath();
          ctx.moveTo(e.radius, 0);
          ctx.lineTo(-e.radius * 0.7, e.radius * 0.7);
          ctx.lineTo(-e.radius * 0.7, -e.radius * 0.7);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (e.type === "drifter") {
          ctx.arc(e.pos.x, e.pos.y, e.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#0a0a0c";
          ctx.beginPath();
          ctx.arc(e.pos.x, e.pos.y, e.radius * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // scrambler: hex
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + e.age;
            const px = e.pos.x + Math.cos(a) * e.radius;
            const py = e.pos.y + Math.sin(a) * e.radius;
            i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // hp pip when damaged
      if (e.hp < e.maxHp && visibility > 0.1) {
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillRect(e.pos.x - e.radius, e.pos.y - e.radius - 8, e.radius * 2 * (e.hp / e.maxHp), 2);
        ctx.globalAlpha = 1;
      }
    }

    // --- Bullets ---
    for (const b of s.bullets) {
      const c0 = BAND_COLORS[b.band];
      ctx.strokeStyle = c0.core;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = c0.glow;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(b.pos.x, b.pos.y);
      ctx.lineTo(b.pos.x - b.vel.x * 0.02, b.pos.y - b.vel.y * 0.02);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // --- Player ---
    const pc = BAND_COLORS[s.player.band];
    const pulse = (Math.sin(s.time * 4) + 1) * 0.5;
    // outer ring
    ctx.strokeStyle = pc.core;
    ctx.lineWidth = 2;
    ctx.globalAlpha = s.player.iframes > 0 ? 0.4 + pulse * 0.4 : 1;
    ctx.beginPath();
    ctx.arc(s.player.pos.x, s.player.pos.y, PLAYER_R + 4 + pulse * 2, 0, Math.PI * 2);
    ctx.stroke();
    // core
    ctx.fillStyle = pc.core;
    ctx.shadowColor = pc.glow;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(s.player.pos.x, s.player.pos.y, PLAYER_R - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    // aim indicator
    const aim = norm({ x: mouseRef.current.x - s.player.pos.x, y: mouseRef.current.y - s.player.pos.y });
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s.player.pos.x + aim.x * 16, s.player.pos.y + aim.y * 16);
    ctx.lineTo(s.player.pos.x + aim.x * 28, s.player.pos.y + aim.y * 28);
    ctx.stroke();

    // --- Float text ---
    ctx.font = "600 14px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    for (const f of s.floatText) {
      ctx.globalAlpha = Math.min(1, f.life * 1.5);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.pos.x, f.pos.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // --- Scramble overlay (HUD distortion when scrambler hits) ---
    if (s.scrambled > 0.05) {
      ctx.globalAlpha = Math.min(0.5, s.scrambled * 0.25);
      ctx.fillStyle = "#ff3366";
      for (let i = 0; i < 6; i++) {
        const y = Math.random() * H;
        ctx.fillRect(0, y, W, 2);
      }
      ctx.globalAlpha = 1;
    }

    // --- HUD ---
    drawHUD(ctx, s);

    // Menu / gameover overlay
    if (s.status === "menu") drawMenu(ctx);
    if (s.status === "gameover") drawGameover(ctx, s);
  }

  function drawHUD(ctx: CanvasRenderingContext2D, s: GameState) {
    // Top bar background
    ctx.fillStyle = "rgba(10,10,12,0.7)";
    ctx.fillRect(0, 0, W, 44);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath(); ctx.moveTo(0, 44); ctx.lineTo(W, 44); ctx.stroke();

    // Score
    ctx.fillStyle = "#e8e8ec";
    ctx.font = "500 11px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText("SCORE", 16, 18);
    ctx.font = "500 22px 'JetBrains Mono', monospace";
    ctx.fillText(String(s.score).padStart(6, "0"), 16, 38);

    // Best
    ctx.fillStyle = "#55555f";
    ctx.font = "500 11px 'JetBrains Mono', monospace";
    ctx.fillText(`BEST  ${s.best}`, 130, 38);

    // Wave
    ctx.textAlign = "center";
    ctx.fillStyle = "#8a8a95";
    ctx.font = "500 10px 'JetBrains Mono', monospace";
    ctx.fillText("WAVE", W / 2, 16);
    ctx.fillStyle = "#e8e8ec";
    ctx.font = "500 22px 'JetBrains Mono', monospace";
    ctx.fillText(String(s.wave).padStart(2, "0"), W / 2, 38);

    // HP
    ctx.textAlign = "right";
    ctx.fillStyle = "#8a8a95";
    ctx.font = "500 10px 'JetBrains Mono', monospace";
    ctx.fillText("INTEGRITY", W - 16, 16);
    for (let i = 0; i < s.player.maxHp; i++) {
      const x = W - 16 - i * 18;
      ctx.fillStyle = i < s.player.hp ? "#5bb8d4" : "rgba(91,184,212,0.15)";
      ctx.fillRect(x - 12, 28, 12, 8);
    }

    // Multiplier
    if (s.multiplier > 1) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#a78bfa";
      ctx.font = "600 28px 'Instrument Serif', serif";
      ctx.fillText(`×${s.multiplier}`, W / 2, H - 60);
      ctx.fillStyle = "#55555f";
      ctx.font = "500 10px 'JetBrains Mono', monospace";
      ctx.fillText("CHAIN", W / 2, H - 76);
    }

    // Frequency tuner (bottom)
    const tunerY = H - 22;
    ctx.fillStyle = "rgba(10,10,12,0.85)";
    ctx.fillRect(0, H - 44, W, 44);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath(); ctx.moveTo(0, H - 44); ctx.lineTo(W, H - 44); ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = "#55555f";
    ctx.font = "500 10px 'JetBrains Mono', monospace";
    ctx.fillText("FREQ", 16, H - 28);

    // Three bands as pills
    const startX = 70;
    for (let i = 0; i < 3; i++) {
      const c0 = BAND_COLORS[i];
      const x = startX + i * 90;
      const active = s.player.band === i;
      ctx.globalAlpha = active ? 1 : 0.35;
      ctx.fillStyle = active ? c0.soft : "rgba(255,255,255,0.04)";
      ctx.strokeStyle = c0.core;
      ctx.lineWidth = active ? 1.5 : 1;
      roundRect(ctx, x, tunerY - 12, 80, 22, 11);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c0.core;
      ctx.font = "500 11px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${i + 1}  ${c0.name}`, x + 40, tunerY + 3);
    }
    ctx.globalAlpha = 1;

    // Hint text right
    ctx.textAlign = "right";
    ctx.fillStyle = "#55555f";
    ctx.font = "500 10px 'JetBrains Mono', monospace";
    ctx.fillText("WASD MOVE   AIM CLICK   1·2·3 / Q·E / WHEEL TUNE", W - 16, H - 22);
  }

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawMenu(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "rgba(10,10,12,0.85)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    // tagline
    ctx.fillStyle = "#55555f";
    ctx.font = "500 11px 'JetBrains Mono', monospace";
    ctx.fillText("TWIN-STICK   ·   DECODER", W / 2, H / 2 - 130);

    // title
    ctx.textAlign = "center";
    ctx.fillStyle = "#e8e8ec";
    ctx.font = "400 84px 'Instrument Serif', serif";
    // Measure for tight kerning
    const titleY = H / 2 - 50;
    ctx.fillText("Signal", W / 2 - 90, titleY);
    ctx.fillStyle = "#5bb8d4";
    ctx.font = "italic 400 84px 'Instrument Serif', serif";
    ctx.fillText("// noise", W / 2 + 110, titleY);

    // body
    ctx.fillStyle = "#8a8a95";
    ctx.font = "400 14px 'Satoshi', sans-serif";
    ctx.fillText("Enemies are sound. Tune your weapon to their frequency.", W / 2, H / 2 + 6);
    ctx.fillText("Match the band to do triple damage. Mistune and they barely flinch.", W / 2, H / 2 + 26);

    // start
    ctx.fillStyle = "#a78bfa";
    ctx.font = "500 14px 'JetBrains Mono', monospace";
    ctx.fillText("[ CLICK OR PRESS SPACE TO START ]", W / 2, H / 2 + 80);

    ctx.fillStyle = "#55555f";
    ctx.font = "500 10px 'JetBrains Mono', monospace";
    ctx.fillText("Headphones recommended.", W / 2, H / 2 + 110);
  }

  function drawGameover(ctx: CanvasRenderingContext2D, s: GameState) {
    ctx.fillStyle = "rgba(10,10,12,0.85)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ff5577";
    ctx.font = "500 11px 'JetBrains Mono', monospace";
    ctx.fillText("S I G N A L   L O S T", W / 2, H / 2 - 100);

    ctx.fillStyle = "#e8e8ec";
    ctx.font = "italic 400 64px 'Instrument Serif', serif";
    ctx.fillText("decoded.", W / 2, H / 2 - 30);

    ctx.fillStyle = "#8a8a95";
    ctx.font = "500 12px 'JetBrains Mono', monospace";
    ctx.fillText(`FINAL SCORE`, W / 2, H / 2 + 10);
    ctx.fillStyle = "#5bb8d4";
    ctx.font = "500 36px 'JetBrains Mono', monospace";
    ctx.fillText(String(s.score), W / 2, H / 2 + 50);
    ctx.fillStyle = "#55555f";
    ctx.font = "500 11px 'JetBrains Mono', monospace";
    ctx.fillText(`WAVE ${s.wave}   ·   BEST ${s.best}`, W / 2, H / 2 + 76);

    ctx.fillStyle = "#a78bfa";
    ctx.font = "500 13px 'JetBrains Mono', monospace";
    ctx.fillText("[ CLICK OR PRESS SPACE TO RETRY ]", W / 2, H / 2 + 120);
  }

  // Click on canvas at menu/gameover starts the game
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const onClick = () => {
      const s = stateRef.current;
      if (s.status === "menu" || s.status === "gameover") startGame();
    };
    c.addEventListener("click", onClick);
    return () => c.removeEventListener("click", onClick);
  }, []);

  return (
    <div className="relative w-full max-w-[960px] mx-auto">
      <div
        className="liquid-glass liquid-glass-glow rounded-xl p-2 relative"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block rounded-lg cursor-crosshair"
          style={{ touchAction: "none" }}
          tabIndex={0}
        />
      </div>
    </div>
  );
}
