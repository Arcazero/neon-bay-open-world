// Neon Bay — drawing only: the city, the cars and people, the HUD with its
// minimap, and the start / pause / busted screens. Canvas 2D, one camera.

import { WORLD_W, WORLD_H, PAL, clamp, dist, fmtMoney, fmtTime } from './config.js';
import { ROAD_W, BEACH_Y } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WIN = 'win';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MINIMAP = 190;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const cam = { x: 0, y: 0, zoom: 1 };
  let viewW = 0;
  let viewH = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.round(viewW * ratio);
    canvas.height = Math.round(viewH * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function text(str, x, y, size, color, align, bold) {
    ctx.font = (bold ? '700 ' : '') + size + 'px ' + FONT;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  function panel(x, y, w, h, fill) {
    ctx.fillStyle = fill || PAL.hudBg;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
  }

  // ---- world -------------------------------------------------------------
  function drawGround(city) {
    ctx.fillStyle = PAL.grass;
    ctx.fillRect(0, 0, viewW, viewH);
    // Sea and sand along the south edge.
    const seaY = 2560 - cam.y;
    if (seaY < viewH) {
      ctx.fillStyle = PAL.water;
      ctx.fillRect(0, Math.max(seaY, 0), viewW, viewH);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      for (let x = 0; x < viewW; x += 90) {
        const yy = seaY + 30 + Math.sin((x + cam.x) * 0.01) * 8;
        ctx.fillRect(x, yy, 46, 3);
      }
    }
    const sandTop = BEACH_Y - cam.y;
    if (sandTop < viewH && sandTop + (WORLD_H - BEACH_Y) > 0) {
      ctx.fillStyle = PAL.sand;
      ctx.fillRect(0, Math.max(sandTop, 0), viewW, Math.min(viewH - Math.max(sandTop, 0), WORLD_H - BEACH_Y));
    }
    // Coral Park lawn.
    const pk = city.park;
    ctx.fillStyle = PAL.park;
    ctx.fillRect(pk.x - cam.x, pk.y - cam.y, pk.w, pk.h);
  }

  function drawRoads(city) {
    ctx.fillStyle = PAL.road;
    for (const rx of city.roadXs) ctx.fillRect(rx - ROAD_W / 2 - cam.x, -cam.y, ROAD_W, WORLD_H);
    for (const ry of city.roadYs) ctx.fillRect(-cam.x, ry - ROAD_W / 2 - cam.y, WORLD_W, ROAD_W);
    // Centre dashes.
    ctx.fillStyle = PAL.roadLine;
    for (const rx of city.roadXs) {
      for (let y = 0; y < WORLD_H; y += 64) ctx.fillRect(rx - 3 - cam.x, y - cam.y, 6, 30);
    }
    for (const ry of city.roadYs) {
      for (let x = 0; x < WORLD_W; x += 64) ctx.fillRect(x - cam.x, ry - 3 - cam.y, 30, 6);
    }
    // Sidewalk edging.
    ctx.fillStyle = PAL.sidewalk;
    for (const rx of city.roadXs) {
      ctx.fillRect(rx - ROAD_W / 2 - cam.x, -cam.y, 8, WORLD_H);
      ctx.fillRect(rx + ROAD_W / 2 - 8 - cam.x, -cam.y, 8, WORLD_H);
    }
  }

  function drawBuildings(city) {
    for (const b of city.buildings) {
      const x = b.x - cam.x;
      const y = b.y - cam.y;
      if (x > viewW || y > viewH || x + b.w < 0 || y + b.h < 0) continue;
      // Drop shadow, then the roof with a darker rim and a skylight.
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x + 8, y + 10, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(x, y, b.w, b.h);
      ctx.strokeStyle = PAL.roofEdge;
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 2, y + 2, b.w - 4, b.h - 4);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x + b.w * 0.2, y + b.h * 0.2, b.w * 0.25, b.h * 0.25);
      if (b.windows) {
        ctx.fillStyle = 'rgba(20,30,60,0.55)';
        const cols = Math.max(1, Math.floor(b.w / 46));
        const rows = Math.max(1, Math.floor(b.h / 46));
        for (let c = 0; c < cols; c += 1) {
          for (let r = 0; r < rows; r += 1) {
            ctx.fillRect(x + 14 + c * 46, y + 14 + r * 46, 22, 16);
          }
        }
      }
    }
  }

  function drawTrees(city) {
    for (const t of city.trees) {
      const x = t.x - cam.x;
      const y = t.y - cam.y;
      if (x < -30 || y < -30 || x > viewW + 30 || y > viewH + 30) continue;
      if (t.palm) {
        ctx.strokeStyle = '#8a6d3b';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 4, y - 18);
        ctx.stroke();
      }
      ctx.fillStyle = t.palm ? '#3fae5a' : PAL.tree;
      ctx.beginPath();
      ctx.arc(x, y - (t.palm ? 20 : 0), t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.arc(x - t.r * 0.25, y - (t.palm ? 20 : 0) - t.r * 0.25, t.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMarker(m) {
    if (!m) return;
    const pulse = 1 + Math.sin(performance.now() / 280) * 0.12;
    const x = m.x - cam.x;
    const y = m.y - cam.y;
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, m.r * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,209,102,0.18)';
    ctx.beginPath();
    ctx.arc(x, y, m.r * pulse, 0, Math.PI * 2);
    ctx.fill();
    // Bouncing beacon above the marker.
    const by = y - 46 - Math.abs(Math.sin(performance.now() / 300)) * 14;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(x, by - 14);
    ctx.lineTo(x + 12, by + 6);
    ctx.lineTo(x - 12, by + 6);
    ctx.closePath();
    ctx.fill();
  }

  function drawCar(car) {
    const x = car.x - cam.x;
    const y = car.y - cam.y;
    if (x < -60 || y < -60 || x > viewW + 60 || y > viewH + 60) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.roundRect(-22 + 4, -12 + 5, 46, 26, 8);
    ctx.fill();
    // Body.
    ctx.fillStyle = car.police ? '#e8e8ec' : car.color;
    ctx.beginPath();
    ctx.roundRect(-24, -13, 48, 26, 8);
    ctx.fill();
    if (car.police) {
      ctx.fillStyle = '#1c1c22';
      ctx.fillRect(-8, -13, 16, 26);
      ctx.fillStyle = PAL.police;
      ctx.fillRect(-20, -13, 8, 6);
      ctx.fillRect(-20, 7, 8, 6);
      ctx.fillStyle = '#ff4757';
      ctx.fillRect(12, -13, 8, 6);
      ctx.fillRect(12, 7, 8, 6);
    }
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,30,50,0.85)';
    ctx.beginPath();
    ctx.roundRect(-8, -10, 16, 20, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,210,255,0.7)';
    ctx.fillRect(6, -9, 4, 18);
    // Headlights.
    ctx.fillStyle = '#fff8c9';
    ctx.fillRect(22, -11, 3, 5);
    ctx.fillRect(22, 6, 3, 5);
    ctx.restore();
  }

  function drawPerson(x, y, angle, color, bob, scale) {
    const px = x - cam.x;
    const py = y - cam.y;
    if (px < -30 || py < -30 || px > viewW + 30 || py > viewH + 30) return;
    const s = scale || 1;
    const wob = Math.sin(bob || 0) * 1.5;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 12 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body: a little runner with a head, shoulders and feet.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-9 * s, -7 * s, 18 * s, 14 * s, 6 * s);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(10 * s, 0, 6.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2b33';
    ctx.beginPath();
    ctx.arc(8 * s, 0, 6.5 * s, Math.PI * 0.6, Math.PI * 1.5);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillRect(-12 * s, -10 * s + wob, 6 * s, 4 * s);
    ctx.fillRect(-12 * s, 6 * s - wob, 6 * s, 4 * s);
    ctx.restore();
  }

  function drawBullets(bullets) {
    ctx.fillStyle = '#ffe66d';
    for (const b of bullets) {
      ctx.beginPath();
      ctx.arc(b.x - cam.x, b.y - cam.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles(particles) {
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - cam.x, p.y - cam.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPickups(pickups) {
    for (const p of pickups) {
      if (p.taken) continue;
      const x = p.x - cam.x;
      const y = p.y - cam.y + Math.sin(p.pulse * 3) * 3;
      ctx.fillStyle = p.kind === 'cash' ? '#ffd166' : '#2ed573';
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1c1c22';
      ctx.font = '700 13px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(p.kind === 'cash' ? '$' : '+', x, y + 5);
    }
  }

  // ---- HUD -----------------------------------------------------------------
  function drawHud(state) {
    const p = state.entities.player;
    const wanted = state.entities.wanted;
    // Top-left: health + cash + district.
    panel(14, 14, 250, 86, PAL.hudBg);
    text('RIO VEGA', 26, 38, 15, PAL.hudText, 'left', true);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(26, 48, 150, 10);
    ctx.fillStyle = p.health > 30 ? '#2ed573' : '#ff4757';
    ctx.fillRect(26, 48, 150 * clamp(p.health / 100, 0, 1), 10);
    text(Math.ceil(p.health) + ' HP', 184, 58, 13, PAL.hudText);
    text(fmtMoney(p.money), 26, 82, 19, '#ffd166', 'left', true);
    text(state.district, 26, 96, 12, 'rgba(255,255,255,0.75)');
    // Top-right: wanted stars.
    panel(viewW - 214, 14, 200, 48, PAL.hudBg);
    text('WANTED', viewW - 202, 34, 12, 'rgba(255,255,255,0.7)', 'left', true);
    for (let i = 0; i < 5; i += 1) {
      text('★', viewW - 150 + i * 22, 42, 22, i < wanted ? '#ff4757' : 'rgba(255,255,255,0.25)', 'left', true);
    }
    // Top-centre: mission objective — panel sized to the text.
    const obj = state.missions.objectiveText();
    ctx.font = '600 15px ' + FONT;
    const objW = Math.min(viewW - 28, ctx.measureText(obj).width + 40);
    panel((viewW - objW) / 2, 14, objW, 44, PAL.hudBg);
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'center';
    ctx.fillText(obj, viewW / 2, 42);
    // Mission message banner.
    if (state.missions.messageTimer > 0) {
      const msg = state.missions.message;
      const msgW = Math.min(viewW - 28, ctx.measureText(msg).width + 40);
      panel((viewW - msgW) / 2, 66, msgW, 36, 'rgba(20,24,40,0.85)');
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(msg, viewW / 2, 89);
    }
    // Bottom-left: context hints + speed.
    const hints = [];
    if (p.inCar) hints.push('W/S drive · A/D steer · Space handbrake · E get out');
    else hints.push('WASD move · Shift run · E enter car · Click shoot · F punch');
    hints.push('M mission · P pause · H mute · ' + state.missions.completedCount + '/5 missions done');
    panel(14, viewH - 66, 430, 52, PAL.hudBg);
    text(hints[0], 26, viewH - 44, 13, PAL.hudText);
    text(hints[1], 26, viewH - 24, 13, 'rgba(255,255,255,0.75)');
    // Bottom-right info block (left of the minimap), backed by a panel so
    // road markings never strike through the text.
    if (p.inCar) {
      const kmh = Math.round(Math.abs(p.inCar.speed) * 0.24);
      panel(viewW - MINIMAP - 320, viewH - 78, 170, 64, PAL.hudBg);
      text(kmh + ' km/h', viewW - MINIMAP - 150, viewH - 30, 26, PAL.hudText, 'right', true);
      text(p.inCar.name, viewW - MINIMAP - 150, viewH - 56, 13, '#ffd166', 'right', true);
    } else if (state.nearCar) {
      const label = 'Press E — steal the ' + state.nearCar;
      ctx.font = '15px ' + FONT;
      const w = Math.min(420, ctx.measureText(label).width + 28);
      panel(viewW - MINIMAP - 140 - w, viewH - 58, w, 44, PAL.hudBg);
      text(label, viewW - MINIMAP - 154, viewH - 30, 15, '#ffd166', 'right', true);
    }
    if (p.ammo !== undefined && !p.inCar) {
      panel(viewW - MINIMAP - 320, viewH - 78, 170, 64, PAL.hudBg);
      text('Ammo ' + p.ammo, viewW - MINIMAP - 150, viewH - 30, 15, PAL.hudText, 'right', true);
    }
    drawMinimap(state);
  }

  function drawMinimap(state) {
    const size = MINIMAP;
    const x0 = viewW - size - 14;
    const y0 = viewH - size - 14;
    const sx = size / WORLD_W;
    const sy = size / WORLD_H;
    panel(x0 - 6, y0 - 6, size + 12, size + 12, 'rgba(10,14,24,0.8)');
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, size, size);
    ctx.clip();
    ctx.fillStyle = '#3f7d3a';
    ctx.fillRect(x0, y0, size, size);
    ctx.fillStyle = '#1fa8c9';
    ctx.fillRect(x0, y0 + BEACH_Y * sy, size, size - BEACH_Y * sy);
    ctx.fillStyle = '#f2d8a0';
    ctx.fillRect(x0, y0 + BEACH_Y * sy, size, 12);
    ctx.fillStyle = '#3a3f4a';
    for (const rx of state.city.roadXs) ctx.fillRect(x0 + rx * sx - 1, y0, 2, size);
    for (const ry of state.city.roadYs) ctx.fillRect(x0, y0 + ry * sy - 1, size, 2);
    const m = state.missions.active;
    if (m && m.marker) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(x0 + m.marker.x * sx, y0 + m.marker.y * sy, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#2f6df6';
    for (const cop of state.entities.cops) {
      ctx.beginPath();
      ctx.arc(x0 + cop.car.x * sx, y0 + cop.car.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = state.entities.player;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    text('NEON BAY', x0, y0 - 10, 11, 'rgba(255,255,255,0.8)', 'left', true);
  }

  // ---- screens ---------------------------------------------------------------
  function drawTitle(state) {
    // A live city behind the title: the camera drifts over Downtown Neon.
    ctx.fillStyle = 'rgba(8,10,20,0.45)';
    ctx.fillRect(0, 0, viewW, viewH);
    panel((viewW - 640) / 2, 90, 640, 420, 'rgba(10,14,24,0.82)');
    ctx.textAlign = 'center';
    text('NEON BAY', viewW / 2, 168, 64, '#ffd166', 'center', true);
    text('An open-world crime story on the Costa Luna coast', viewW / 2, 200, 18, '#ffffff', 'center');
    text('Rio Vega owes Marisol Kane $5,000. Five jobs. One city. No rules.', viewW / 2, 228, 15, 'rgba(255,255,255,0.8)', 'center');
    const lines = [
      'WASD / arrows — move & drive      E — steal / enter car',
      'Mouse — aim      Click — shoot      F — punch      Shift — sprint',
      'Steal cars, dodge the Bay PD, finish all 5 missions.',
      'Your progress saves automatically in this browser.',
    ];
    lines.forEach((l, i) => text(l, viewW / 2, 280 + i * 28, 15, 'rgba(255,255,255,0.85)', 'center'));
    text(state.hasSave ? 'Press Enter — Continue your story' : 'Press Enter — Start a new story', viewW / 2, 420, 18, '#ffd166', 'center', true);
    text('or click anywhere to begin', viewW / 2, 452, 13, 'rgba(255,255,255,0.6)', 'center');
    if (state.best) text('Best run: ' + fmtMoney(state.best) + '  ·  ' + state.bestMissions + '/5 missions', viewW / 2, 484, 13, 'rgba(255,255,255,0.6)', 'center');
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(8,10,20,0.55)';
    ctx.fillRect(0, 0, viewW, viewH);
    panel((viewW - 420) / 2, (viewH - 200) / 2, 420, 200, 'rgba(10,14,24,0.9)');
    text('PAUSED', viewW / 2, viewH / 2 - 40, 40, '#ffffff', 'center', true);
    text('Neon Bay waits for no one — except now.', viewW / 2, viewH / 2, 15, 'rgba(255,255,255,0.8)', 'center');
    text('Press P to resume', viewW / 2, viewH / 2 + 44, 16, '#ffd166', 'center', true);
  }

  function drawBusted(state) {
    ctx.fillStyle = 'rgba(20,4,8,0.72)';
    ctx.fillRect(0, 0, viewW, viewH);
    text('BUSTED', viewW / 2, viewH / 2 - 60, 72, '#ff4757', 'center', true);
    text('The Bay PD finally caught up with Rio Vega.', viewW / 2, viewH / 2 - 10, 18, '#ffffff', 'center');
    text('You kept ' + fmtMoney(state.entities.player.money) + ' and finished ' + state.missions.completedCount + ' of 5 missions.', viewW / 2, viewH / 2 + 24, 15, 'rgba(255,255,255,0.85)', 'center');
    text('Press Enter to get back on the streets', viewW / 2, viewH / 2 + 70, 17, '#ffd166', 'center', true);
  }

  function drawWin(state) {
    ctx.fillStyle = 'rgba(8,20,10,0.72)';
    ctx.fillRect(0, 0, viewW, viewH);
    text('NEON BAY IS YOURS', viewW / 2, viewH / 2 - 60, 52, '#ffd166', 'center', true);
    text('All five jobs done. The debt is paid. Rio Vega owns this city now.', viewW / 2, viewH / 2 - 10, 18, '#ffffff', 'center');
    text('Final take: ' + fmtMoney(state.entities.player.money), viewW / 2, viewH / 2 + 24, 17, '#ffffff', 'center', true);
    text('Press Enter to keep cruising in free roam', viewW / 2, viewH / 2 + 70, 16, '#ffd166', 'center', true);
  }

  // ---- main draw -------------------------------------------------------------
  function draw(state, screen) {
    resize();
    const p = state.entities.player;
    cam.x = clamp(p.x - viewW / 2, 0, WORLD_W - viewW);
    cam.y = clamp(p.y - viewH / 2, 0, WORLD_H - viewH);
    if (screen === SCREEN_TITLE) {
      // Slow drift over the city for the title backdrop.
      const t = performance.now() / 1000;
      cam.x = 1200 + Math.sin(t * 0.05) * 700;
      cam.y = 500 + Math.cos(t * 0.04) * 300;
    }
    ctx.fillStyle = '#0b0e18';
    ctx.fillRect(0, 0, viewW, viewH);
    drawGround(state.city);
    drawRoads(state.city);
    drawBuildings(state.city);
    drawTrees(state.city);
    const m = state.missions.active;
    if (m && m.marker) drawMarker(m.marker);
    drawPickups(state.entities.pickups);
    for (const car of state.entities.cars) drawCar(car);
    for (const ped of state.entities.peds) drawPerson(ped.x, ped.y, ped.angle, ped.color, ped.bob, 0.9);
    for (const cop of state.entities.cops) {
      drawPerson(cop.car.x, cop.car.y, cop.car.angle, '#1c4fd6', performance.now() / 90, 1);
    }
    if (!p.inCar) drawPerson(p.x, p.y, p.angle, '#ffcf3f', performance.now() / 90, 1.1);
    drawBullets(state.entities.bullets);
    drawParticles(state.entities.particles);
    if (screen === SCREEN_TITLE) drawTitle(state);
    else if (screen === SCREEN_PAUSED) { drawHud(state); drawPaused(); }
    else if (screen === SCREEN_BUSTED) drawBusted(state);
    else if (screen === SCREEN_WIN) { drawHud(state); drawWin(state); }
    else drawHud(state);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
