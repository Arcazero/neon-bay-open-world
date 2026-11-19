// Neon Bay — shared constants, palette and small helpers.
// Every value here is original to this game: a sun-soaked coastal city
// called Neon Bay, on the fictional island of Costa Luna.

export const WORLD_W = 3600;
export const WORLD_H = 2800;

// Palette: warm sand, teal sea, coral roofs, palm green.
export const PAL = {
  grass: '#7ec850',
  grassDark: '#6db844',
  sand: '#f2d8a0',
  water: '#1fa8c9',
  waterDeep: '#0f7ea6',
  road: '#3a3f4a',
  roadLine: '#f5d76e',
  sidewalk: '#b9b3a4',
  curb: '#8f887a',
  buildingA: '#ff9d76',
  buildingB: '#ffd166',
  buildingC: '#7fb5ff',
  buildingD: '#c77dff',
  buildingE: '#8affc1',
  roofEdge: 'rgba(0,0,0,0.25)',
  tree: '#2f9e44',
  treeDark: '#237a33',
  park: '#5cb85c',
  hudBg: 'rgba(10,14,24,0.72)',
  hudText: '#ffffff',
  accent: '#ffcf3f',
  danger: '#ff4757',
  police: '#2f6df6',
};

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Deterministic RNG (mulberry32) so screenshot poses are reproducible.
export function makeRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function fmtMoney(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}

export function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}
