// Market run: a short dash through the market for the goods you ran out of.
// Tap left or right to change lane, catch the goods you need, dodge puddles, okadas and wheelbarrows
// (each bump costs 2 seconds). Browser only: main.js starts it and gets back what was caught.
import { good } from './art.js';

const LANES = 3;
const BUMP_MS = 2000;

const OBSTACLES = {
  puddle: '<svg width="52" height="30" viewBox="0 0 52 30" aria-hidden="true"><ellipse cx="26" cy="17" rx="24" ry="11" fill="#6FA8D6"/><ellipse cx="20" cy="14" rx="9" ry="3" fill="#CFE7F7"/></svg>',
  okada: '<svg width="56" height="44" viewBox="0 0 56 44" aria-hidden="true"><circle cx="12" cy="32" r="9" fill="none" stroke="#1F2A24" stroke-width="4"/><circle cx="44" cy="32" r="9" fill="none" stroke="#1F2A24" stroke-width="4"/><path d="M12 32 L24 18 H38 L44 32" fill="none" stroke="#C0392B" stroke-width="5" stroke-linecap="round"/><circle cx="30" cy="8" r="6" fill="#5C3A21"/><path d="M30 14 L28 22" stroke="#2F6FB0" stroke-width="6" stroke-linecap="round"/></svg>',
  bicycle: '<svg width="56" height="40" viewBox="0 0 56 40" aria-hidden="true"><circle cx="12" cy="28" r="10" fill="none" stroke="#1F2A24" stroke-width="3"/><circle cx="44" cy="28" r="10" fill="none" stroke="#1F2A24" stroke-width="3"/><path d="M12 28 L22 12 L36 12 L44 28 M22 12 L30 28 L36 12 M20 8 H26 M36 12 L38 6" fill="none" stroke="#2F6FB0" stroke-width="3" stroke-linecap="round"/></svg>',
  barrow: '<svg width="56" height="40" viewBox="0 0 56 40" aria-hidden="true"><path d="M6 10 H40 L34 26 H12 Z" fill="#8A939C"/><circle cx="22" cy="32" r="6" fill="#1F2A24"/><path d="M40 12 L54 22" stroke="#8B5A2B" stroke-width="4" stroke-linecap="round"/></svg>',
};

const RUNNER = '<svg width="48" height="56" viewBox="0 0 48 56" aria-hidden="true"><circle cx="24" cy="12" r="10" fill="#7A4A2A"/><path d="M12 54 L16 26 H32 L36 54" fill="#0E6B43"/><path d="M16 30 L6 40 M32 30 L42 40" stroke="#7A4A2A" stroke-width="5" stroke-linecap="round"/></svg>';

export function runnerSvg() { return RUNNER; }

// items: [{ item, qty }]. Calls onEnd({ item: caught }, { injured }) once: everything caught, time up,
// or the runner is hit by a bicycle or okada and breaks a leg (chance injuryChance).
// training: no goods to catch, no injuries; just dodge until time is up and count the bumps.
export function startRun(field, { items, seconds = 20, injuryChance = 0, training = false, onEnd, onTick }) {
  let hits = 0;
  const need = Object.fromEntries(items.map((it) => [it.item, it.qty]));
  const got = Object.fromEntries(items.map((it) => [it.item, 0]));
  const slow = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const fallPerSec = slow ? 0.32 : 0.5; // share of the field's height per second
  const W = field.clientWidth;
  const H = field.clientHeight;
  const laneW = W / LANES;
  const player = field.querySelector('.runner');
  let lane = 1;
  let timeLeft = seconds * 1000;
  let spawnIn = 300;
  let last = performance.now();
  let ended = false;
  let frame = 0;
  const objs = [];

  const x = (l, w) => l * laneW + laneW / 2 - w / 2;
  const place = (el, l, y, w) => { el.style.transform = `translate(${x(l, w)}px, ${y}px)`; };
  const playerY = H - 64;
  place(player, lane, playerY, 48);

  const move = (d) => {
    if (ended) return;
    lane = Math.max(0, Math.min(LANES - 1, lane + d));
    place(player, lane, playerY, 48);
  };

  const stillNeeded = () => Object.keys(need).filter((k) => got[k] < need[k]);

  function spawn() {
    const wanted = stillNeeded();
    const isGood = !training && wanted.length && Math.random() < 0.55;
    const el = document.createElement('div');
    el.className = 'run-obj';
    let kind;
    let w;
    if (isGood) {
      kind = wanted[Math.floor(Math.random() * wanted.length)];
      el.innerHTML = good(kind, 44);
      w = 44;
    } else {
      kind = ['puddle', 'okada', 'barrow', 'bicycle'][Math.floor(Math.random() * 4)];
      el.innerHTML = OBSTACLES[kind];
      w = 56;
    }
    const o = { el, lane: Math.floor(Math.random() * LANES), y: -50, good: !!isGood, kind, w };
    place(el, o.lane, o.y, w);
    field.appendChild(el);
    objs.push(o);
  }

  function flash(cls) {
    player.classList.remove('hit', 'got');
    void player.offsetWidth; // restart the animation
    player.classList.add(cls);
  }

  function step(now) {
    if (ended) return;
    const dt = Math.min(64, now - last);
    last = now;
    timeLeft -= dt;
    spawnIn -= dt;
    if (spawnIn <= 0) { spawn(); spawnIn = 520 + Math.random() * 380; }
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i];
      o.y += (dt / 1000) * H * fallPerSec;
      place(o.el, o.lane, o.y, o.w);
      const touching = o.lane === lane && o.y > playerY - 40 && o.y < playerY + 30;
      if (touching) {
        if (o.good && got[o.kind] < need[o.kind]) { got[o.kind]++; flash('got'); }
        if (!o.good) {
          if (training) hits++;
          if (!training && (o.kind === 'bicycle' || o.kind === 'okada') && Math.random() < injuryChance) { o.el.remove(); return end(true, o.kind); }
          if (!training) timeLeft -= BUMP_MS;
          flash('hit');
        }
      }
      if (touching || o.y > H) { o.el.remove(); objs.splice(i, 1); }
    }
    onTick?.({ timeLeft: Math.max(0, timeLeft), got, need, hits });
    if ((!training && !stillNeeded().length) || timeLeft <= 0) return end();
    frame = requestAnimationFrame(step);
  }

  const left = () => move(-1);
  const right = () => move(1);
  const tapField = (e) => { const r = field.getBoundingClientRect(); move(e.clientX - r.left < r.width / 2 ? -1 : 1); };
  const leftBtn = document.getElementById('run-left');
  const rightBtn = document.getElementById('run-right');
  leftBtn?.addEventListener('pointerdown', left);
  rightBtn?.addEventListener('pointerdown', right);
  field.addEventListener('pointerdown', tapField);

  function cleanup() {
    ended = true;
    cancelAnimationFrame(frame);
    leftBtn?.removeEventListener('pointerdown', left);
    rightBtn?.removeEventListener('pointerdown', right);
    field.removeEventListener('pointerdown', tapField);
  }
  function end(injured = false, by = null) {
    cleanup();
    onEnd({ ...got }, { injured, by, hits });
  }

  frame = requestAnimationFrame((t) => { last = t; step(t); });
  return cleanup; // stop without a result (e.g. the player sent the boy instead)
}
