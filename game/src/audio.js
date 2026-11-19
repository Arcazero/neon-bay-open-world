// Neon Bay — all sound is synthesised live with WebAudio: no audio files.
// Engine hum, sirens, gunfire, pickups, and a laid-back synthwave loop.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  // Called from the first user gesture (or the title screen click).
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    startEngine();
    startMusic();
  }

  function startEngine() {
    if (engineOsc || !ctx) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 42;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  // speed01: 0 parked .. 1 flat out. Called every frame while driving.
  function engine(speed01, on) {
    if (!ctx || !engineOsc) return;
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
    engineOsc.frequency.setTargetAtTime(42 + speed01 * 110, t, 0.1);
  }

  function startSiren() {
    if (!ctx || sirenOsc) return;
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 720;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    // Two-tone wail: alternate 720 / 950 Hz every 0.45 s.
    const wail = () => {
      if (!sirenOsc || !ctx) return;
      sirenOsc.frequency.setTargetAtTime(sirenOsc.frequency.value > 800 ? 720 : 950, ctx.currentTime, 0.05);
      setTimeout(wail, 450);
    };
    wail();
  }

  function siren(on) {
    if (!ctx) return;
    if (on) {
      startSiren();
      if (sirenGain) sirenGain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.2);
    } else if (sirenGain) {
      sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, lowpass) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1800;
    const g = ctx.createGain();
    g.gain.value = vol || 0.25;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
  }

  const sfx = {
    shoot() { noiseBurst(0.12, 0.3, 2400); blip(160, 0.08, 'square', 0.12, 60); },
    punch() { noiseBurst(0.08, 0.2, 900); },
    pickup() { blip(660, 0.12, 'sine', 0.18, 990); },
    cash() { blip(880, 0.1, 'sine', 0.18); setTimeout(() => blip(1320, 0.16, 'sine', 0.18), 90); },
    crash() { noiseBurst(0.25, 0.35, 700); },
    sirenOn() { siren(true); },
    sirenOff() { siren(false); },
    wantedUp() { blip(220, 0.2, 'square', 0.12, 440); },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.18), i * 110));
    },
    hurt() { blip(140, 0.18, 'sawtooth', 0.16, 70); },
    click() { blip(700, 0.05, 'square', 0.08); },
  };

  // A slow synthwave loop: bass notes + a soft pad chord, stepped on a timer.
  const BASS = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
  const CHORDS = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [146.83, 220, 293.66]];
  function startMusic() {
    if (musicTimer || !ctx) return;
    musicTimer = setInterval(() => {
      if (muted || !ctx) return;
      const bar = Math.floor(musicStep / 8) % CHORDS.length;
      const note = BASS[musicStep % BASS.length];
      blip(note, 0.5, 'triangle', 0.07);
      if (musicStep % 8 === 0) {
        for (const f of CHORDS[bar]) blip(f, 1.8, 'sine', 0.03);
      }
      if (musicStep % 2 === 0) noiseBurst(0.03, 0.03, 6000); // hat tick
      musicStep += 1;
    }, 240);
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  return { unlock, engine, siren, sfx, toggleMute, isMuted: () => muted };
}
