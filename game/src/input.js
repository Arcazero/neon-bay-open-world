// Neon Bay — keyboard and mouse input. Held keys are read every frame;
// one-shot presses (confirm, pause, enter car, punch, mission, mute) are
// queued as flags and taken once by the loop, so no press is ever lost.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MISSION = 16;
export const ACTION_MUTE = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const HANDBRAKE = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const MISSION = new Set(['KeyM']);
const MUTE = new Set(['KeyH']);

export function createInput(canvas, onShoot, toWorld) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  function codeOf(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    const code = codeOf(event);
    held.add(code);
    if (event.repeat) return;
    if (CONFIRM.has(code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (ENTER.has(code)) actions |= ACTION_ENTER;
    else if (PUNCH.has(code)) actions |= ACTION_PUNCH;
    else if (MISSION.has(code)) actions |= ACTION_MISSION;
    else if (MUTE.has(code)) actions |= ACTION_MUTE;
    if (UP.has(code) || DOWN.has(code) || LEFT.has(code) || RIGHT.has(code) || HANDBRAKE.has(code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(codeOf(event));
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouseDown = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    mouseDown = true;
    if (event.button === 0) actions |= ACTION_CONFIRM;
    if (onShoot) onShoot();
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  function has(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    up: () => has(UP),
    down: () => has(DOWN),
    left: () => has(LEFT),
    right: () => has(RIGHT),
    sprint: () => has(SPRINT),
    handbrake: () => has(HANDBRAKE),
    mouseDown: () => mouseDown,
    // Mouse position in world coordinates, for aiming.
    aimWorld(cam) {
      return { x: mouseX + cam.x, y: mouseY + cam.y };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
