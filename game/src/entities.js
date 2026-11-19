// Neon Bay — the living city: the player on foot and behind the wheel,
// traffic cars, pedestrians, police, bullets, pickups and particles.
// No drawing here; render.js paints whatever this module simulates.

import { WORLD_W, WORLD_H, clamp, dist, angleTo, angleDiff, makeRng, pick } from './config.js';
import { collideCircle, onRoad, nearestRoad, buildingAt } from './world.js';

export const CAR_COLORS = ['#ff5d5d', '#ffd166', '#7fb5ff', '#8affc1', '#c77dff', '#f8f9fa', '#2ec4b6', '#ff8fab'];
export const CAR_NAMES = ['Comet GT', 'Palma Cruiser', 'Sunset Sedan', 'Bay Runner', 'Coral Coupe', 'Luna Van', 'Turbo Hatch', 'Marina GT'];

const FOOT_SPEED = 230;
const FOOT_SPRINT = 350;
const CAR_ACCEL = 520;
const CAR_MAX_SPEED = 620;
const CAR_REVERSE = 220;

export function createEntities(city, seed) {
  const rng = makeRng(seed * 7 + 13);
  const player = {
    x: 1800, y: 1180, angle: -Math.PI / 2, radius: 14,
    health: 100, money: 250, ammo: 24, inCar: null,
    speed: 0, moving: false, punchTimer: 0, hurtTimer: 0,
    name: 'Rio Vega',
  };
  const cars = [];
  const peds = [];
  const cops = [];
  const bullets = [];
  const particles = [];
  const pickups = [];
  let wanted = 0;
  let wantedHeat = 0; // 0..1 progress toward the next star
  let wantedDecay = 0;
  let carId = 0;

  function addCar(x, y, angle, opts) {
    const car = {
      id: carId += 1,
      x, y, angle, speed: 0,
      color: (opts && opts.color) || pick(rng, CAR_COLORS),
      name: (opts && opts.name) || pick(rng, CAR_NAMES),
      police: !!(opts && opts.police),
      traffic: !!(opts && opts.traffic),
      parked: !!(opts && opts.parked),
      target: null, // traffic waypoint {x, y}
      wait: 0,
      stolen: false,
    };
    cars.push(car);
    return car;
  }

  function seedWorld() {
    // Parked cars along the roads, ready to steal.
    for (const spot of city.parkingSpots.slice(0, 26)) {
      addCar(spot.x, spot.y, spot.angle, { parked: true });
    }
    // Traffic already rolling.
    for (let i = 0; i < 14; i += 1) {
      const road = pick(rng, city.roadXs);
      const lane = pick(rng, city.roadYs);
      const c = addCar(road, lane, rng() < 0.5 ? 0 : Math.PI / 2, { traffic: true });
      c.speed = 120 + rng() * 80;
    }
    // Pedestrians strolling the sidewalks and the beach.
    for (let i = 0; i < 34; i += 1) {
      peds.push({
        x: 120 + rng() * (WORLD_W - 240),
        y: 120 + rng() * (WORLD_H - 400),
        angle: rng() * Math.PI * 2,
        speed: 26 + rng() * 30,
        color: pick(rng, ['#ff6b9d', '#4ecdc4', '#ffe66d', '#a78bfa', '#f4a261', '#90be6d']),
        panic: 0, wait: rng() * 3, bob: rng() * 6,
      });
    }
    // Cash and health pickups scattered around the city.
    for (let i = 0; i < 10; i += 1) {
      pickups.push({
        x: 200 + rng() * (WORLD_W - 400),
        y: 200 + rng() * (WORLD_H - 600),
        kind: i % 3 === 0 ? 'health' : 'cash',
        amount: i % 3 === 0 ? 35 : 50 + Math.floor(rng() * 150),
        taken: false, pulse: rng() * 6,
      });
    }
  }

  function spawnPolice(n) {
    for (let i = 0; i < n; i += 1) {
      const a = rng() * Math.PI * 2;
      const r = 420 + rng() * 260;
      const x = clamp(player.x + Math.cos(a) * r, 60, WORLD_W - 60);
      const y = clamp(player.y + Math.sin(a) * r, 60, WORLD_H - 60);
      const road = nearestRoad(city, x, y);
      const car = addCar(road.x, road.y, 0, { police: true, color: '#1c1c22' });
      car.speed = 200;
      cops.push({ car, onFoot: false, punchTimer: 0 });
    }
  }

  function removePoliceCar(car) {
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
    const j = cops.findIndex((c) => c.car === car);
    if (j >= 0) cops.splice(j, 1);
  }

  function addWanted(amount, reason) {
    const before = wanted;
    wantedHeat += amount;
    while (wantedHeat >= 1 && wanted < 5) {
      wantedHeat -= 1;
      wanted += 1;
      spawnPolice(1);
    }
    wantedHeat = clamp(wantedHeat, 0, 1);
    return { raised: wanted > before, reason };
  }

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = rng() * Math.PI * 2;
      const s = (0.3 + rng() * 0.7) * (speed || 160);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + rng() * 0.4, max: 0.9, color, r: 2 + rng() * 3 });
    }
  }

  function shoot(tx, ty) {
    if (player.ammo <= 0 || player.inCar) return false;
    player.ammo -= 1;
    const a = angleTo(player.x, player.y, tx, ty);
    bullets.push({ x: player.x + Math.cos(a) * 20, y: player.y + Math.sin(a) * 20, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: 0.7, fromPlayer: true });
    burst(player.x + Math.cos(a) * 24, player.y + Math.sin(a) * 24, '#ffd166', 3, 90);
    addWanted(0.34, 'gunfire');
    return true;
  }

  function punch() {
    if (player.punchTimer > 0 || player.inCar) return;
    player.punchTimer = 0.35;
    const reach = 46;
    const px = player.x + Math.cos(player.angle) * reach;
    const py = player.y + Math.sin(player.angle) * reach;
    for (const ped of peds) {
      if (dist(px, py, ped.x, ped.y) < 26) {
        ped.panic = 4;
        ped.x += Math.cos(player.angle) * 30;
        ped.y += Math.sin(player.angle) * 30;
        burst(ped.x, ped.y, '#ffffff', 6, 120);
        addWanted(0.2, 'assault');
        return;
      }
    }
    for (const cop of cops) {
      if (!cop.onFoot) continue;
      if (dist(px, py, cop.car.x, cop.car.y) < 30) {
        cop.car.x += Math.cos(player.angle) * 26;
        cop.car.y += Math.sin(player.angle) * 26;
        burst(cop.car.x, cop.car.y, '#ffffff', 6, 120);
        addWanted(0.5, 'hit a cop');
        return;
      }
    }
  }

  function enterCar() {
    if (player.inCar) {
      const car = player.inCar;
      player.inCar = null;
      player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      player.angle = car.angle;
      car.parked = true;
      return 'out';
    }
    let best = null;
    let bestD = 60;
    for (const car of cars) {
      const d = dist(player.x, player.y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    if (!best) return null;
    if (best.police) {
      addWanted(0.5, 'stole a police car');
    } else if (best.traffic) {
      best.traffic = false;
      addWanted(0.5, 'carjacking');
      burst(best.x, best.y, '#ffcf3f', 8, 120);
    } else if (best.parked && !best.stolen) {
      best.stolen = true;
      addWanted(0.5, 'stole a parked car');
      burst(best.x, best.y, '#ffcf3f', 8, 120);
    }
    best.parked = false;
    player.inCar = best;
    return 'in';
  }

  function nearestCarDist() {
    let bestD = Infinity;
    for (const car of cars) {
      const d = dist(player.x, player.y, car.x, car.y);
      if (d < bestD) bestD = d;
    }
    return bestD;
  }

  // ---- per-frame updates -------------------------------------------------
  function stepPlayer(dt, input, events) {
    player.punchTimer = Math.max(0, player.punchTimer - dt);
    player.hurtTimer = Math.max(0, player.hurtTimer - dt);
    const car = player.inCar;
    if (car) {
      // Driving: W/S throttle, A/D steer, Space handbrake.
      const fwd = (input.up ? 1 : 0) - (input.down ? 0.55 : 0);
      const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      const maxSpd = input.handbrake ? CAR_MAX_SPEED * 0.55 : CAR_MAX_SPEED;
      car.speed += fwd * CAR_ACCEL * dt;
      car.speed -= car.speed * (input.handbrake ? 2.2 : 0.35) * dt;
      car.speed = clamp(car.speed, -CAR_REVERSE, maxSpd);
      const grip = clamp(Math.abs(car.speed) / 200, 0.25, 1);
      if (Math.abs(car.speed) > 5) {
        car.angle += steer * 2.1 * grip * dt * Math.sign(car.speed);
      }
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const before = { x: car.x, y: car.y };
      car.x = nx;
      car.y = ny;
      if (collideCircle(city, car, 20)) {
        if (Math.abs(car.speed) > 240) {
          burst(car.x, car.y, '#ffb703', 10, 200);
          events.push({ type: 'crash', hard: true });
          car.speed *= -0.25;
        } else {
          car.speed *= 0.4;
        }
        car.x = before.x;
        car.y = before.y;
      }
      // Hitting pedestrians while driving is a crime.
      for (const ped of peds) {
        if (dist(car.x, car.y, ped.x, ped.y) < 26 && Math.abs(car.speed) > 60) {
          ped.panic = 5;
          ped.x += Math.cos(car.angle) * 60;
          ped.y += Math.sin(car.angle) * 60;
          burst(ped.x, ped.y, '#ff4757', 8, 160);
          addWanted(0.5, 'hit a pedestrian');
          events.push({ type: 'hitPed' });
          car.speed *= 0.7;
        }
      }
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      player.speed = Math.abs(car.speed);
      player.moving = Math.abs(car.speed) > 10;
      return;
    }
    // On foot: WASD/arrows move, mouse aims, Shift sprints.
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }
    const spd = input.sprint ? FOOT_SPRINT : FOOT_SPEED;
    player.x += mx * spd * dt;
    player.y += my * spd * dt;
    collideCircle(city, player, player.radius);
    player.moving = len > 0;
    player.speed = len > 0 ? spd : 0;
    if (len > 0) player.angle = Math.atan2(my, mx);
    if (input.aim) player.angle = angleTo(player.x, player.y, input.aim.x, input.aim.y);
  }

  function stepTraffic(dt) {
    for (const car of cars) {
      if (!car.traffic || car === player.inCar) continue;
      if (car.wait > 0) { car.wait -= dt; continue; }
      if (!car.target) {
        const road = nearestRoad(city, car.x, car.y);
        const vertical = Math.abs(car.x - road.x) < Math.abs(car.y - road.y);
        if (vertical) {
          car.target = { x: road.x + (Math.random() < 0.5 ? -14 : 14), y: car.y + (Math.random() < 0.5 ? -1 : 1) * (300 + Math.random() * 400) };
        } else {
          car.target = { x: car.x + (Math.random() < 0.5 ? -1 : 1) * (300 + Math.random() * 400), y: road.y + (Math.random() < 0.5 ? -14 : 14) };
        }
      }
      const d = dist(car.x, car.y, car.target.x, car.target.y);
      if (d < 24) {
        car.target = null;
        if (Math.random() < 0.25) car.wait = 1 + Math.random() * 2;
        continue;
      }
      const want = angleTo(car.x, car.y, car.target.x, car.target.y);
      car.angle += clamp(angleDiff(car.angle, want), -1.6 * dt, 1.6 * dt);
      car.speed = Math.min(car.speed + 120 * dt, 150);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (collideCircle(city, car, 18)) {
        car.target = null;
        car.speed = 40;
      }
      // Keep traffic off the player: swerve around a stopped player car.
      if (player.inCar && dist(car.x, car.y, player.inCar.x, player.inCar.y) < 46) {
        car.speed = Math.max(0, car.speed - 300 * dt);
      }
    }
    // Top the traffic back up so the streets never empty out.
    const rolling = cars.filter((c) => c.traffic).length;
    if (rolling < 10 && Math.random() < dt * 0.5) {
      const road = pick(rng, city.roadXs);
      const lane = pick(rng, city.roadYs);
      const c = addCar(road, lane, Math.random() < 0.5 ? 0 : Math.PI / 2, { traffic: true });
      c.speed = 120;
    }
  }

  function stepPeds(dt) {
    for (const ped of peds) {
      ped.bob += dt * 6;
      if (ped.panic > 0) {
        ped.panic -= dt;
        const away = angleTo(player.x, player.y, ped.x, ped.y);
        ped.angle = away;
        ped.x += Math.cos(away) * 190 * dt;
        ped.y += Math.sin(away) * 190 * dt;
        collideCircle(city, ped, 10);
        continue;
      }
      if (ped.wait > 0) { ped.wait -= dt; continue; }
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (buildingAt(city, ped.x, ped.y) || ped.x < 40 || ped.x > WORLD_W - 40 || ped.y < 40 || ped.y > WORLD_H - 40) {
        ped.angle += Math.PI * (0.5 + Math.random());
        ped.x = clamp(ped.x, 40, WORLD_W - 40);
        ped.y = clamp(ped.y, 40, WORLD_H - 40);
      }
      if (Math.random() < dt * 0.08) ped.wait = 1 + Math.random() * 3;
      if (Math.random() < dt * 0.05) ped.angle = Math.random() * Math.PI * 2;
    }
  }

  function stepPolice(dt, events) {
    // Wanted stars decay when the player stays clean and out of sight.
    if (wanted > 0) {
      wantedDecay += dt;
      if (wantedDecay > 14) {
        wantedDecay = 0;
        wanted -= 1;
        wantedHeat = 0;
        if (cops.length > wanted) {
          const extra = cops[cops.length - 1];
          removePoliceCar(extra.car);
        }
        events.push({ type: 'wantedDown', wanted });
      }
    }
    for (const cop of [...cops]) {
      const car = cop.car;
      if (cop.onFoot) {
        const d = dist(car.x, car.y, player.x, player.y);
        if (d > 520) {
          // Too far behind: get back in the car and drive.
          cop.onFoot = false;
          car.speed = 100;
          continue;
        }
        const a = angleTo(car.x, car.y, player.x, player.y);
        car.x += Math.cos(a) * 200 * dt;
        car.y += Math.sin(a) * 200 * dt;
        collideCircle(city, car, 12);
        if (d < 34 && cop.punchTimer <= 0) {
          cop.punchTimer = 0.9;
          hurtPlayer(12, events);
        }
        cop.punchTimer -= dt;
        continue;
      }
      // Driving pursuit: chase the player, ram them.
      const d = dist(car.x, car.y, player.x, player.y);
      const want = angleTo(car.x, car.y, player.x, player.y);
      car.angle += clamp(angleDiff(car.angle, want), -2.4 * dt, 2.4 * dt);
      const targetSpeed = wanted >= 3 ? 560 : 470;
      car.speed = Math.min(car.speed + 380 * dt, targetSpeed);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (collideCircle(city, car, 20)) car.speed *= 0.5;
      if (player.inCar && d < 44 && Math.abs(car.speed) > 120) {
        player.inCar.speed *= 0.55;
        car.speed *= 0.5;
        burst(player.x, player.y, '#ffffff', 6, 140);
        events.push({ type: 'rammed' });
        hurtPlayer(4, events);
      }
      // Close on foot: the cop bails out and chases on foot.
      if (!player.inCar && d < 90) {
        cop.onFoot = true;
        car.speed = 0;
      }
      // Give up if the player is long gone and wanted is low.
      if (d > 1400 && wanted <= 1 && Math.random() < dt * 0.1) removePoliceCar(car);
    }
  }

  function hurtPlayer(amount, events) {
    if (player.hurtTimer > 0) return;
    player.hurtTimer = 0.5;
    player.health = Math.max(0, player.health - amount);
    events.push({ type: 'hurt' });
    if (player.health <= 0) events.push({ type: 'busted' });
  }

  function stepBullets(dt, events) {
    for (const b of [...bullets]) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || buildingAt(city, b.x, b.y)) {
        bullets.splice(bullets.indexOf(b), 1);
        continue;
      }
      if (b.fromPlayer) {
        for (const ped of peds) {
          if (dist(b.x, b.y, ped.x, ped.y) < 16) {
            ped.panic = 5;
            burst(ped.x, ped.y, '#ff4757', 8, 160);
            bullets.splice(bullets.indexOf(b), 1);
            addWanted(0.5, 'shot a pedestrian');
            break;
          }
        }
        for (const cop of cops) {
          if (dist(b.x, b.y, cop.car.x, cop.car.y) < 20) {
            burst(cop.car.x, cop.car.y, '#2f6df6', 10, 180);
            bullets.splice(bullets.indexOf(b), 1);
            removePoliceCar(cop.car);
            addWanted(0.5, 'shot a cop');
            events.push({ type: 'copDown' });
            break;
          }
        }
      }
    }
  }

  function stepPickups(dt, events) {
    for (const p of pickups) {
      if (p.taken) continue;
      p.pulse += dt;
      if (dist(player.x, player.y, p.x, p.y) < 34) {
        p.taken = true;
        if (p.kind === 'cash') {
          player.money += p.amount;
          events.push({ type: 'cash', amount: p.amount });
        } else {
          player.health = Math.min(100, player.health + p.amount);
          events.push({ type: 'heal', amount: p.amount });
        }
        burst(p.x, p.y, p.kind === 'cash' ? '#ffd166' : '#2ed573', 10, 140);
      }
    }
  }

  function stepParticles(dt) {
    for (const p of [...particles]) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= dt;
      if (p.life <= 0) particles.splice(particles.indexOf(p), 1);
    }
  }

  function step(dt, input, events) {
    stepPlayer(dt, input, events);
    stepTraffic(dt);
    stepPeds(dt);
    stepPolice(dt, events);
    stepBullets(dt, events);
    stepPickups(dt, events);
    stepParticles(dt);
  }

  seedWorld();
  return {
    player, cars, peds, cops, bullets, particles, pickups,
    step, shoot, punch, enterCar, nearestCarDist, burst, hurtPlayer,
    addWanted,
    get wanted() { return wanted; },
    set wanted(v) { wanted = clamp(Math.round(v), 0, 5); },
    get wantedHeat() { return wantedHeat; },
  };
}
