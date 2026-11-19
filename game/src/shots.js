// Neon Bay — the screenshot scenes behind ?shot=start|chase|mission|foot.
// Each one stages a real moment of play from the live simulation (a stolen
// car mid-chase, a mission marker, the title over the city) and steps it
// forward a few seconds, so the frame is what the game really looks like.
// The same seed always gives the same frame.

import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';

const STEP = 1 / 60;

function scriptedInput(over) {
  return {
    up: !!over.up,
    down: !!over.down,
    left: !!over.left,
    right: !!over.right,
    sprint: !!over.sprint,
    handbrake: !!over.handbrake,
    aim: over.aim || null,
  };
}

function driveForward(game, seconds) {
  for (let i = 0; i < seconds / STEP; i += 1) {
    const events = [];
    game.entities.step(STEP, scriptedInput({ up: true }), events);
    game.missions.step(STEP, events);
  }
}

function idle(game, seconds) {
  for (let i = 0; i < seconds / STEP; i += 1) {
    const events = [];
    game.entities.step(STEP, scriptedInput({}), events);
    game.missions.step(STEP, events);
  }
}

// Put the player in the nearest parked car and point it down a road.
function stealNearestCar(game) {
  const p = game.entities.player;
  let best = null;
  let bestD = Infinity;
  for (const car of game.entities.cars) {
    if (!car.parked) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return null;
  p.x = best.x;
  p.y = best.y;
  game.entities.enterCar();
  return best;
}

export function stageShot(name, game, seed) {
  const p = game.entities.player;
  if (name === 'chase') {
    // Cover shot: Rio in a stolen Comet GT, 3 stars, Bay PD in pursuit,
    // mission 4 (Getaway Driver) live with the safehouse marker ahead.
    // The car starts ON the east-west avenue (y = 1360) so it can run.
    p.x = 1700;
    p.y = 1360;
    const car = stealNearestCar(game);
    if (car) {
      car.angle = 0; // east, down the avenue toward the safehouse
      car.x = 1700;
      car.y = 1360;
      car.color = '#ff5d5d'; // a red Comet GT reads best on the cover
      car.name = 'Comet GT';
    }
    game.entities.addWanted(2.9, 'screenshot chase');
    game.entities.addWanted(0.6, 'screenshot chase');
    const m4 = game.missions.list[3];
    game.missions.startMission(m4);
    driveForward(game, 3.5);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // On foot outside the Downtown Neon bank, vault job live, 2 stars.
    p.x = 2400;
    p.y = 340;
    p.angle = 0;
    game.entities.addWanted(2.4, 'screenshot mission');
    const m5 = game.missions.list[4];
    game.missions.startMission(m5);
    idle(game, 1.5);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'foot') {
    // On foot in Downtown Neon: traffic, pedestrians, a cash pickup,
    // mission 1 (First Wheels) waiting with its marker in view.
    p.x = 1500;
    p.y = 1050;
    p.angle = -Math.PI / 2;
    const m1 = game.missions.list[0];
    game.missions.startMission(m1);
    idle(game, 2.5);
    return { screen: SCREEN_PLAY };
  }
  // Default: the title screen over a living city.
  idle(game, 5);
  return { screen: SCREEN_TITLE };
}
