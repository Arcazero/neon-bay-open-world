// Neon Bay — the city itself: road grid, building blocks, beach, park,
// harbour, and the collision tests everything else uses.
// The map is generated once from a seed, so every visit plays the same city.

import { WORLD_W, WORLD_H, PAL, makeRng, pick, clamp } from './config.js';

export const ROAD_W = 96; // road surface width, including sidewalks
export const BLOCK = 340; // pitch of the road grid
export const BEACH_Y = 2380; // sand starts here; sea below 2560

const ROOF_COLORS = [PAL.buildingA, PAL.buildingB, PAL.buildingC, PAL.buildingD, PAL.buildingE];

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const roadXs = [];
  const roadYs = [];
  for (let x = BLOCK; x < WORLD_W; x += BLOCK) roadXs.push(x);
  for (let y = BLOCK; y < BEACH_Y; y += BLOCK) roadYs.push(y);

  // Buildings fill each block between roads, with a margin for sidewalk.
  for (let gx = 0; gx < roadXs.length; gx += 1) {
    for (let gy = 0; gy < roadYs.length; gy += 1) {
      const bx = roadXs[gx] + ROAD_W / 2 + 14;
      const by = roadYs[gy] + ROAD_W / 2 + 14;
      const bw = BLOCK - ROAD_W - 28;
      const bh = BLOCK - ROAD_W - 28;
      // The central block is Coral Park, not buildings.
      const isPark = gx === 4 && gy === 3;
      if (isPark) {
        for (let t = 0; t < 26; t += 1) {
          trees.push({
            x: bx + 20 + rng() * (bw - 40),
            y: by + 20 + rng() * (bh - 40),
            r: 12 + rng() * 10,
          });
        }
        continue;
      }
      // Some blocks hold two smaller buildings instead of one big one.
      if (rng() < 0.45) {
        const split = rng() < 0.5;
        const gap = 16;
        if (split) {
          const w1 = bw * (0.4 + rng() * 0.2);
          buildings.push(makeBuilding(bx, by, w1, bh, rng));
          buildings.push(makeBuilding(bx + w1 + gap, by, bw - w1 - gap, bh, rng));
        } else {
          const h1 = bh * (0.4 + rng() * 0.2);
          buildings.push(makeBuilding(bx, by, bw, h1, rng));
          buildings.push(makeBuilding(bx, by + h1 + gap, bw, bh - h1 - gap, rng));
        }
      } else {
        buildings.push(makeBuilding(bx, by, bw, bh, rng));
      }
    }
  }

  // Palm trees along the beach promenade and a few on street corners.
  for (let x = 80; x < WORLD_W; x += 130) {
    trees.push({ x: x + rng() * 40, y: BEACH_Y + 46 + rng() * 30, r: 14 + rng() * 6, palm: true });
  }
  for (let i = 0; i < 40; i += 1) {
    trees.push({
      x: 60 + rng() * (WORLD_W - 120),
      y: 60 + rng() * (BEACH_Y - 120),
      r: 10 + rng() * 8,
    });
  }

  // Named districts, for the HUD location line and mission text.
  const districts = [
    { name: 'Old Marina', x: 0, y: 0, w: 1100, h: 900 },
    { name: 'Coral Park', x: 1400, y: 1000, w: 500, h: 500 },
    { name: 'Downtown Neon', x: 1800, y: 0, w: 1800, h: 1100 },
    { name: 'Sunset Strip', x: 0, y: 1100, w: 1200, h: 1200 },
    { name: 'Harbour Heights', x: 1800, y: 1400, w: 1800, h: 900 },
    { name: 'Palma Beach', x: 0, y: BEACH_Y, w: WORLD_W, h: WORLD_H - BEACH_Y },
  ];

  // Parked cars and mission props sit on road edges; the entity layer picks spots.
  const parkingSpots = [];
  for (let gx = 0; gx < roadXs.length; gx += 1) {
    for (let gy = 0; gy < roadYs.length; gy += 1) {
      if (rng() < 0.6) {
        parkingSpots.push({
          x: roadXs[gx] + (rng() < 0.5 ? -ROAD_W / 2 + 16 : ROAD_W / 2 - 16),
          y: roadYs[gy] + 60 + rng() * 160,
          angle: rng() < 0.5 ? 0 : Math.PI,
        });
      }
    }
  }

  return { buildings, trees, roadXs, roadYs, districts, parkingSpots, park: { x: roadXs[4] + ROAD_W / 2 + 14, y: roadYs[3] + ROAD_W / 2 + 14, w: BLOCK - ROAD_W - 28, h: BLOCK - ROAD_W - 28 } };
}

function makeBuilding(x, y, w, h, rng) {
  return {
    x, y, w, h,
    color: pick(rng, ROOF_COLORS),
    height: 1 + Math.floor(rng() * 3), // visual storeys for the roof shading
    windows: rng() < 0.7,
  };
}

// True when the point is on a road (or the beach promenade / sand).
export function onRoad(city, x, y) {
  if (y >= BEACH_Y) return true;
  for (const rx of city.roadXs) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of city.roadYs) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

// Nearest road centre line to a point, used by traffic to stay on the grid.
export function nearestRoad(city, x, y) {
  let bestX = city.roadXs[0];
  let bestD = Infinity;
  for (const rx of city.roadXs) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; bestX = rx; }
  }
  let bestY = city.roadYs[0];
  bestD = Infinity;
  for (const ry of city.roadYs) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; bestY = ry; }
  }
  return { x: bestX, y: bestY };
}

export function buildingAt(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// Push a circle (entity of radius r) out of buildings and the world edge.
// Returns true when a collision happened.
export function collideCircle(city, ent, r) {
  let hit = false;
  ent.x = clamp(ent.x, r, WORLD_W - r);
  ent.y = clamp(ent.y, r, WORLD_H - r);
  for (const b of city.buildings) {
    const cx = clamp(ent.x, b.x, b.x + b.w);
    const cy = clamp(ent.y, b.y, b.y + b.h);
    const dx = ent.x - cx;
    const dy = ent.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.001) {
        const d = Math.sqrt(d2);
        ent.x = cx + (dx / d) * r;
        ent.y = cy + (dy / d) * r;
      } else {
        ent.y = b.y - r; // centre inside: push up out of the roof
      }
    }
  }
  return hit;
}

export function districtAt(city, x, y) {
  for (const d of city.districts) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return 'Neon Bay';
}
