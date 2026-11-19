// Neon Bay — the story: five missions for Rio Vega, a driver fresh out of
// the Marina lock-up, trying to pay off a debt to the fixer Marisol Kane.
// Each mission has a marker, an objective, and a cash reward.

import { dist, fmtMoney } from './config.js';

// Mission states: 'idle' (not started), 'active', 'done'.
export function createMissions(city, entities) {
  const list = [
    {
      id: 1,
      title: 'First Wheels',
      brief: 'Marisol needs wheels. Steal any car and bring it to the Coral Park garage.',
      marker: { x: 1700, y: 1360, r: 70 }, // the Coral Park garage, on the avenue
      reward: 300,
      needCar: true,
      state: 'idle',
      hint: 'Walk up to a parked car and press E to steal it.',
    },
    {
      id: 2,
      title: 'The Package',
      brief: 'Pick up the package at the Old Marina docks and deliver it to the Sunset Strip club.',
      marker: { x: 340, y: 340, r: 60 }, // the Old Marina docks, on the corner
      reward: 500,
      state: 'idle',
      hint: 'Reach the yellow marker on foot. No car needed — but one helps.',
      stage: 0,
    },
    {
      id: 3,
      title: 'Hot Pursuit',
      brief: 'The Bay PD is on to you. Survive 45 seconds with a 2-star wanted level.',
      marker: null,
      reward: 700,
      state: 'idle',
      timer: 45,
      hint: 'Keep moving. Cops give up if you stay out of sight.',
    },
    {
      id: 4,
      title: 'Getaway Driver',
      brief: 'Drive Marisol\'s courier to the Harbour Heights safehouse in 75 seconds — with the cops already on you.',
      marker: { x: 3200, y: 2050, r: 80 },
      reward: 1000,
      needCar: true,
      state: 'idle',
      timer: 75,
      hint: 'Grab a fast car first. The timer starts when you leave the Strip.',
    },
    {
      id: 5,
      title: 'The Big Score',
      brief: 'Hit the Downtown Neon bank vault, then lose the heat and reach the Palma Beach hideout.',
      marker: { x: 2560, y: 340, r: 70 }, // the Downtown Neon bank, on the avenue
      reward: 2500,
      state: 'idle',
      hint: 'Stand in the marker to crack the vault. Then run.',
      stage: 0,
    },
  ];

  let active = null;
  let message = '';
  let messageTimer = 0;
  let completedCount = 0;

  function startMission(m) {
    m.state = 'active';
    active = m;
    message = 'Mission started: ' + m.title;
    messageTimer = 4;
    if (m.id === 3) {
      entities.addWanted(2.4, 'mission heat');
      m.grace = 3;
    }
    if (m.id === 4) {
      entities.addWanted(1.6, 'mission heat');
    }
    return m;
  }

  function nextIdle() {
    return list.find((m) => m.state === 'idle') || null;
  }

  function completeMission(m, events) {
    m.state = 'done';
    active = null;
    completedCount += 1;
    entities.player.money += m.reward;
    message = 'Mission complete: ' + m.title + '  +' + fmtMoney(m.reward);
    messageTimer = 5;
    events.push({ type: 'missionDone', mission: m });
  }

  function failMission(m, why) {
    m.state = 'idle';
    m.timer = m.id === 3 ? 45 : m.id === 4 ? 75 : m.timer;
    m.stage = 0;
    active = null;
    message = 'Mission failed: ' + why + ' — try again.';
    messageTimer = 5;
  }

  // Advance the active mission. Returns nothing; pushes events.
  function step(dt, events) {
    if (messageTimer > 0) messageTimer -= dt;
    const p = entities.player;
    if (!active) return;
    const m = active;
    const at = m.marker ? dist(p.x, p.y, m.marker.x, m.marker.y) < m.marker.r : false;

    if (m.id === 1) {
      if (at && p.inCar) completeMission(m, events);
    } else if (m.id === 2) {
      if (m.stage === 0 && at) {
        m.stage = 1;
        m.marker = { x: 680, y: 1700, r: 70 }; // the Sunset Strip club, on the avenue
        message = 'Package collected. Deliver it to the Sunset Strip club.';
        messageTimer = 4;
        events.push({ type: 'pickup' });
      } else if (m.stage === 1 && at) {
        completeMission(m, events);
      }
    } else if (m.id === 3) {
      if (m.grace > 0) m.grace -= dt;
      else if (entities.wanted < 2) {
        failMission(m, 'you lost the heat too early — get spotted first');
        return;
      }
      m.timer -= dt;
      if (m.timer <= 0) completeMission(m, events);
    } else if (m.id === 4) {
      m.timer -= dt;
      if (m.timer <= 0) {
        failMission(m, 'out of time');
        return;
      }
      if (at && p.inCar) completeMission(m, events);
    } else if (m.id === 5) {
      if (m.stage === 0 && at) {
        m.stage = 1;
        m.marker = { x: 3200, y: 2480, r: 80 };
        entities.player.money += 1500; // vault cash, on top of the reward
        entities.addWanted(2.4, 'bank job');
        message = 'Vault cracked! +$1,500. Lose the cops and reach Palma Beach.';
        messageTimer = 5;
        events.push({ type: 'cash', amount: 1500 });
      } else if (m.stage === 1 && at && entities.wanted === 0) {
        completeMission(m, events);
      } else if (m.stage === 1 && at && entities.wanted > 0) {
        message = 'Too hot — lose the wanted level first!';
        messageTimer = 2;
      }
    }
  }

  function objectiveText() {
    if (!active) {
      const next = nextIdle();
      if (!next) return 'All missions complete — Neon Bay is yours. Free roam!';
      return 'Next: ' + next.title + ' — press M to start';
    }
    const m = active;
    if (m.id === 3) return m.title + ': survive the heat — ' + Math.ceil(m.timer) + 's left';
    if (m.id === 4) return m.title + ': reach the safehouse — ' + Math.ceil(m.timer) + 's left';
    if (m.id === 5 && m.stage === 1) return m.title + ': reach Palma Beach with no heat';
    return m.title + ': ' + m.brief;
  }

  return {
    list, step, startMission, nextIdle,
    get active() { return active; },
    get message() { return message; },
    get messageTimer() { return messageTimer; },
    get completedCount() { return completedCount; },
    objectiveText,
  };
}
