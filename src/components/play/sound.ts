/**
 * A few synthesized sounds, so the games need no audio files. Nothing plays
 * until the first call, which always follows a click or key press.
 */
let ctx: AudioContext | null = null;
let muted = false;

function audio() {
  if (muted || typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, to: number, length: number, type: OscillatorType, gain: number, delay = 0) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + length);
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(amp).connect(ac.destination);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

function noise(length: number, gain: number, cutoff: number) {
  const ac = audio();
  if (!ac) return;
  const frames = Math.floor(ac.sampleRate * length);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  const amp = ac.createGain();
  amp.gain.value = gain;
  src.connect(filter).connect(amp).connect(ac.destination);
  src.start();
}

export const sound = {
  setMuted(value: boolean) {
    muted = value;
  },
  shot() {
    noise(0.07, 0.16, 2600);
    tone(190, 60, 0.08, "triangle", 0.12);
  },
  hit() {
    tone(900, 1500, 0.07, "sine", 0.1);
  },
  pop() {
    tone(520, 1040, 0.09, "triangle", 0.13);
    tone(1040, 1560, 0.09, "sine", 0.07, 0.04);
  },
  thud() {
    tone(140, 50, 0.16, "sine", 0.22);
    noise(0.05, 0.08, 900);
  },
  swing() {
    noise(0.11, 0.07, 1400);
  },
  bad() {
    tone(240, 110, 0.22, "sawtooth", 0.07);
  },
  good() {
    tone(660, 660, 0.09, "triangle", 0.09);
    tone(990, 990, 0.14, "triangle", 0.09, 0.08);
  },
  end() {
    tone(523, 523, 0.14, "triangle", 0.09);
    tone(659, 659, 0.14, "triangle", 0.09, 0.12);
    tone(784, 784, 0.26, "triangle", 0.09, 0.24);
  },
};
