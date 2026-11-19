// Neon Bay — boot and the one loop: input is read every frame, the city
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title, play, paused, busted, win (all five missions done).
// Progress saves to localStorage after every mission and on busted.
//
// ?seed=N fixes the city. ?shot=start|chase|mission|foot (with &seed=N)
// stages that scene instead of running the loop, paints it, and sets
// window.__shotReady for a screenshot.

import { WORLD_W, WORLD_H, clamp } from './config.js';
import { buildCity, districtAt } from './world.js';
import { createEntities } from './entities.js';
import { createMissions } from './missions.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_BUSTED, SCREEN_WIN } from './render.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_PUNCH, ACTION_MISSION, ACTION_MUTE } from './input.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const SAVE_KEY = 'neon-bay.save.v1';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261119;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const city = buildCity(seed);
const entities = createEntities(city, seed);
const missions = createMissions(city, entities);
const audio = createAudio();
const renderer = createRenderer(canvas);

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: entities.player.money,
      health: entities.player.health,
      ammo: entities.player.ammo,
      missionsDone: missions.list.filter((m) => m.state === 'done').map((m) => m.id),
      x: entities.player.x,
      y: entities.player.y,
      savedAt: Date.now(),
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function applySave(save) {
  if (!save) return;
  entities.player.money = save.money || 0;
  entities.player.health = save.health || 100;
  entities.player.ammo = save.ammo || 24;
  entities.player.x = save.x || entities.player.x;
  entities.player.y = save.y || entities.player.y;
  for (const id of save.missionsDone || []) {
    const m = missions.list.find((mm) => mm.id === id);
    if (m) m.state = 'done';
  }
}

const saved = readSave();
let bestMoney = saved ? saved.money : 0;
let bestMissions = saved ? (saved.missionsDone || []).length : 0;

function runShot(name) {
  const scene = stageShot(name, { city, entities, missions }, seed);
  let painted = 0;
  function paint() {
    renderer.draw(snapshotState(), scene.screen);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function snapshotState() {
  const p = entities.player;
  let nearCar = null;
  if (!p.inCar) {
    let bestD = 60;
    for (const car of entities.cars) {
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < bestD) { bestD = d; nearCar = car.name; }
    }
  }
  return {
    city, entities, missions,
    district: districtAt(city, p.x, p.y),
    nearCar,
    hasSave: !!saved,
    best: bestMoney,
    bestMissions,
  };
}

function runGame() {
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let cam = { x: 0, y: 0 };
  let fireTimer = 0;

  const input = createInput(canvas, () => {
    // Mouse click: shoot, but only while playing on foot.
    if (screen === SCREEN_PLAY && !entities.player.inCar) {
      const aim = input.aimWorld(cam);
      if (entities.shoot(aim.x, aim.y)) audio.sfx.shoot();
    }
  });

  function announce(message) {
    status.textContent = message;
  }

  function currentCam() {
    const p = entities.player;
    cam = {
      x: clamp(p.x - window.innerWidth / 2, 0, WORLD_W - window.innerWidth),
      y: clamp(p.y - window.innerHeight / 2, 0, WORLD_H - window.innerHeight),
    };
    return cam;
  }

  function startGame(fresh) {
    if (fresh) {
      try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    } else if (saved) {
      applySave(saved);
    }
    audio.unlock();
    screen = SCREEN_PLAY;
    announce('Playing Neon Bay. Rio Vega is on the streets.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(false);
      return;
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) {
        if (screen === SCREEN_BUSTED) {
          entities.player.health = 100;
          entities.player.x = 1800;
          entities.player.y = 1180;
          entities.wanted = 0;
          screen = SCREEN_PLAY;
        } else {
          screen = SCREEN_PLAY;
        }
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      screen = screen === SCREEN_PLAY ? SCREEN_PAUSED : SCREEN_PLAY;
      announce(screen === SCREEN_PAUSED ? 'Paused.' : 'Playing.');
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_ENTER) {
      const result = entities.enterCar();
      if (result === 'in') audio.sfx.pickup();
      else if (result === 'out') audio.sfx.click();
    }
    if (actions & ACTION_PUNCH) {
      entities.punch();
      audio.sfx.punch();
    }
    if (actions & ACTION_MISSION) {
      const next = missions.nextIdle();
      if (next) {
        missions.startMission(next);
        audio.sfx.pickup();
      }
    }
  }

  function step() {
    const p = entities.player;
    fireTimer = Math.max(0, fireTimer - STEP);
    const inputState = {
      up: input.up(),
      down: input.down(),
      left: input.left(),
      right: input.right(),
      sprint: input.sprint(),
      handbrake: input.handbrake(),
      aim: input.mouseDown() ? input.aimWorld(currentCam()) : null,
    };
    const events = [];
    entities.step(STEP, inputState, events);
    missions.step(STEP, events);
    audio.engine(p.inCar ? Math.abs(p.inCar.speed) / 620 : 0, !!p.inCar);
    audio.siren(entities.wanted > 0);
    for (const e of events) {
      if (e.type === 'crash' && e.hard) audio.sfx.crash();
      else if (e.type === 'hurt') audio.sfx.hurt();
      else if (e.type === 'cash') audio.sfx.cash();
      else if (e.type === 'pickup') audio.sfx.pickup();
      else if (e.type === 'heal') audio.sfx.pickup();
      else if (e.type === 'missionDone') {
        audio.sfx.missionDone();
        writeSave();
        bestMoney = Math.max(bestMoney, p.money);
        bestMissions = missions.completedCount;
        if (missions.completedCount >= 5) screen = SCREEN_WIN;
      } else if (e.type === 'busted') {
        audio.sfx.hurt();
        writeSave();
        screen = SCREEN_BUSTED;
      }
    }
    // Holding the mouse sprays bullets while on foot (one shot per 0.18 s).
    if (input.mouseDown() && screen === SCREEN_PLAY && !p.inCar && p.ammo > 0 && fireTimer <= 0) {
      const aim = input.aimWorld(currentCam());
      if (entities.shoot(aim.x, aim.y)) {
        audio.sfx.shoot();
        fireTimer = 0.18;
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_TITLE) {
      // The city lives behind the title: traffic and pedestrians move.
      while (accumulator >= STEP) {
        const events = [];
        entities.step(STEP, { up: false, down: false, left: false, right: false, sprint: false, handbrake: false, aim: null }, events);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(snapshotState(), screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  canvas.addEventListener('pointerdown', () => audio.unlock(), { once: true });

  announce('Neon Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
