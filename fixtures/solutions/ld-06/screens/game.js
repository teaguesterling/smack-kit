import { card, list } from '../kit/parts.js';
import { scoreFor } from '../seams/score.js';
import { nextLetter } from '../seams/pick.js';
import { fallPixelsPerSecond } from '../seams/speed.js';
import { openStore } from '../kit/store.js';

const store = openStore('letter-drop');

const LETTERS_PER_GAME = 20;

export function renderMenu(root, state) {
  const pick = list(state.levels, lv => {
    const b = document.createElement('button');
    b.className = 'level';
    b.textContent = `${lv.name} (${lv.speed})`;
    b.addEventListener('click', () => state.actions.play(lv));
    return b;
  });
  const best = document.createElement('p');
  best.id = 'best';
  root.replaceChildren(card({ title: 'Pick a level', body: pick }), best);
  store.get('best').then(b => { best.textContent = `High score: ${b ?? 0}`; });
}

/** Runs one game on a canvas. Returns a controller; onEnd(score) is called once. */
export function startGame(root, level, onEnd) {
  const canvas = document.createElement('canvas');
  canvas.id = 'board';
  const hud = document.createElement('div');
  hud.id = 'hud';
  hud.innerHTML = '<span id="score">Score 0</span> <span id="streak">Streak 0</span>';
  root.replaceChildren(hud, canvas);
  const ctx = canvas.getContext('2d');
  let score = 0, streak = 0, dropped = 0, ended = false, last = performance.now();
  const falling = [];
  const speed = fallPixelsPerSecond(level.speed);

  function spawn() {
    if (dropped >= LETTERS_PER_GAME) return;
    dropped++;
    falling.push({ ch: nextLetter(level.pool, Math.random), x: 20 + Math.random() * Math.max(1, canvas.width - 40), y: 0 });
  }
  function hud_() {
    document.getElementById('score').textContent = `Score ${score}`;
    document.getElementById('streak').textContent = `Streak ${streak}`;
  }
  function press(key) {
    const i = falling.findIndex(f => f.ch === key.toLowerCase());
    const hit = i >= 0;
    score += scoreFor(hit, streak);
    streak = hit ? streak + 1 : 0;
    if (hit) falling.splice(i, 1);
    hud_();
  }
  function end() {
    if (ended) return;
    ended = true;
    removeEventListener('keydown', onKey);
    store.get('best').then(b => (score > (b ?? 0) ? store.set('best', score) : null)).then(() => onEnd(score));
  }
  function onKey(e) { if (e.key.length === 1) press(e.key); }
  function frame(now) {
    if (ended) return;
    canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight;
    const dt = (now - last) / 1000; last = now;
    for (const f of falling) f.y += speed * dt;
    for (let i = falling.length - 1; i >= 0; i--) if (falling[i].y > canvas.height) { falling.splice(i, 1); score += scoreFor(false, streak); streak = 0; hud_(); }
    if (falling.length === 0) spawn();
    if (dropped >= LETTERS_PER_GAME && falling.length === 0) { end(); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '32px system-ui';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--kit-text');
    for (const f of falling) ctx.fillText(f.ch, f.x, f.y);
    requestAnimationFrame(frame);
  }
  addEventListener('keydown', onKey);
  spawn();
  requestAnimationFrame(frame);
  return { press, end, falling: () => falling.map(f => f.ch), score: () => score };
}
