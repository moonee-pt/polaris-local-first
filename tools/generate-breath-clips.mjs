/**
 * Renders the breath bed clips into public/sfx/flesh/breath.
 *
 * A breath is turbulent noise shaped by the airway, so it is generated directly:
 * pink-ish noise through a band-pass whose centre sags as the air runs out, an
 * asymmetric envelope, and a slow flutter from the throat moving. Seeds are fixed,
 * so re-running this produces byte-identical files.
 *
 *   node tools/generate-breath-clips.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 44100;
const OUTPUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/sfx/flesh/breath');

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RBJ band-pass; q below ~1 keeps the breath soft instead of whistly. */
function bandpass(samples, centreHz, q) {
  const omega = (2 * Math.PI * centreHz) / SAMPLE_RATE;
  const sn = Math.sin(omega);
  const cs = Math.cos(omega);
  const alpha = sn / (2 * q);
  const b0 = alpha;
  const b1 = 0;
  const b2 = -alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * cs;
  const a2 = 1 - alpha;
  const n1 = b0 / a0;
  const n2 = b1 / a0;
  const n3 = b2 / a0;
  const d1 = a1 / a0;
  const d2 = a2 / a0;

  const out = new Float32Array(samples.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const x0 = samples[index];
    const y0 = n1 * x0 + n2 * x1 + n3 * x2 - d1 * y1 - d2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    out[index] = y0;
  }
  return out;
}

/** One-pole high-frequency bleed, so the clip is air rather than hiss. */
function soften(samples, mix) {
  const out = new Float32Array(samples.length);
  let previous = samples[0];
  for (let index = 0; index < samples.length; index += 1) {
    previous = previous + mix * (samples[index] - previous);
    out[index] = previous;
  }
  return out;
}

function envelope(length, shape) {
  const out = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const t = length === 1 ? 0 : index / (length - 1);
    // Skew < 0.5 peaks early (a breath pushed out), > 0.5 peaks late (air drawn in).
    const skewed = Math.pow(t, shape.skew < 0.5 ? 1 - shape.skew : shape.skew);
    const bell = Math.sin(Math.PI * Math.pow(skewed, shape.tightness));
    out[index] = Math.max(0, bell);
  }
  return out;
}

function renderBreath(seed) {
  const rng = createRng(seed);
  const seconds = 0.55 + rng() * 0.85;
  const length = Math.round(seconds * SAMPLE_RATE);
  const inhale = rng() > 0.55;

  let white = 0;
  const noise = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    // Three cascaded one-poles give the pink tilt a real breath carries.
    const sample = rng() * 2 - 1;
    white = 0.99 * white + 0.01 * sample;
    noise[index] = sample * 0.6 + white * 0.4;
  }

  const centre = 420 + rng() * 620;
  const shaped = bandpass(soften(noise, 0.35), centre, 0.55 + rng() * 0.4);
  const env = envelope(length, {
    skew: inhale ? 0.62 : 0.34,
    tightness: 0.8 + rng() * 0.7
  });
  const flutterRate = 4.5 + rng() * 3.5;
  const flutterDepth = 0.06 + rng() * 0.1;
  const peak = 0.3 + rng() * 0.22;

  const out = new Float32Array(length);
  let highest = 0;
  for (let index = 0; index < length; index += 1) {
    const t = index / SAMPLE_RATE;
    const flutter = 1 - flutterDepth + flutterDepth * Math.sin(2 * Math.PI * flutterRate * t);
    const value = shaped[index] * env[index] * flutter;
    highest = Math.max(highest, Math.abs(value));
    out[index] = value;
  }
  const scale = highest > 0 ? peak / highest : 0;
  for (let index = 0; index < length; index += 1) out[index] *= scale;

  // 8 ms at each end keeps the bed from clicking.
  const edge = Math.round(0.008 * SAMPLE_RATE);
  for (let index = 0; index < edge; index += 1) {
    const ramp = index / edge;
    out[index] *= ramp;
    out[length - 1 - index] *= ramp;
  }
  return out;
}

function encodeWav(samples) {
  const bytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + bytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + bytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(bytes, 40);
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + index * 2);
  }
  return buffer;
}

mkdirSync(OUTPUT_DIR, { recursive: true });
for (let index = 1; index <= 8; index += 1) {
  const name = `breath${String(index).padStart(2, '0')}`;
  const samples = renderBreath(index * 7919 + 13);
  const seconds = (samples.length / SAMPLE_RATE).toFixed(2);
  writeFileSync(join(OUTPUT_DIR, `${name}.wav`), encodeWav(samples));
  console.log(`${name}.wav ${seconds}s`);
}
