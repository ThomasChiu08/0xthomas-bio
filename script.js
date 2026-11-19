import { LiquidGlass } from './vendor/apple-liquid-glass-webgl/src/index.js';

const paper = document.querySelector('#paper');
const ctx = paper.getContext('2d', { alpha: false });
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const dock = document.querySelector('.dock');
const tabs = [...document.querySelectorAll('.tab')];
const selection = document.querySelector('.selection');
const lenses = [];
const views = ['home', 'projects', 'investing', 'studio', 'contact'];
const aliases = { work: 'projects', photo: 'studio' };

const grain = document.createElement('canvas');
grain.width = grain.height = 192;
const grainCtx = grain.getContext('2d');
const pixels = grainCtx.createImageData(192, 192);
let seed = 7429;
for (let i = 0; i < pixels.data.length; i += 4) {
  seed = (1664525 * seed + 1013904223) >>> 0;
  const n = (seed >>> 24) / 255;
  pixels.data[i] = 91; pixels.data[i + 1] = 79; pixels.data[i + 2] = 61;
  pixels.data[i + 3] = Math.round(n * 13);
}
grainCtx.putImageData(pixels, 0, 0);

function paintPaper() {
  const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio, 2);
  paper.width = w * dpr; paper.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const wash = ctx.createLinearGradient(0, h * .15, w, h * .85);
  [[0,'#ffffff'],[.3,'#f8f6f1'],[.49,'#eeebe4'],[.515,'#c2bfb8'],[.53,'#fffefa'],[.59,'#fdfcf9'],[.78,'#eeebe4'],[1,'#fffefa']].forEach(([p,c]) => wash.addColorStop(p,c));
  ctx.fillStyle = wash; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = ctx.createPattern(grain, 'repeat'); ctx.fillRect(0, 0, w, h);
  for (const el of document.querySelectorAll('.glass')) {
    const b = el.getBoundingClientRect();
    const r = Math.min(b.width / 2, b.height / 2, parseFloat(getComputedStyle(el).borderRadius));
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.roundRect(b.x, b.y, b.width, b.height, r); ctx.clip('evenodd');
    ctx.shadowColor = '#49413a55'; ctx.shadowBlur = 18; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#f8f6f1'; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.width, b.height, r); ctx.fill();
    ctx.restore();
  }
}
function refresh() { paintPaper(); LiquidGlass.refreshAll(); }
function resize() { paintPaper(); positionSelection(); refresh(); }
function positionSelection() {
  const active = tabs.find(tab => tab.hasAttribute('aria-current')) || tabs[0];
  selection.style.width = `${active.offsetWidth}px`;
  selection.style.transform = `translateX(${active.offsetLeft - parseFloat(getComputedStyle(selection).left)}px)`;
}
function select(name) {
  for (const tab of tabs) {
    if (tab.dataset.tab === name) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  positionSelection();
}
function setView(view) {
  document.body.dataset.view = view;
  for (const screen of document.querySelectorAll('[data-screen]')) {
    const on = screen.dataset.screen === view;
    screen.toggleAttribute('inert', !on);
    screen.setAttribute('aria-hidden', on ? 'false' : 'true');
  }
}
function navigate(name, focus = true) {
  name = aliases[name] || name;
  if (!views.includes(name)) return;
  document.querySelectorAll('details[open]').forEach(detail => { detail.open = false; });
  setView(name);
  select(name);
  const screen = document.querySelector(`[data-screen="${name}"]`);
  const focusTarget = screen.querySelector('h1') || screen;
  if (focus) focusTarget.focus({ preventScroll: true });
  scrollTo({ top: 0, behavior: reduced.matches ? 'instant' : 'smooth' });
  refresh();
}

for (const tab of tabs) tab.addEventListener('click', event => {
  event.preventDefault();
  const name = tab.dataset.tab;
  history.replaceState(null, '', `#${name}`);
  navigate(name);
});
dock.addEventListener('keydown', event => {
  const index = tabs.indexOf(document.activeElement);
  if (index < 0) return;
  let next;
  if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
  if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
  if (event.key === 'Home') next = 0;
  if (event.key === 'End') next = tabs.length - 1;
  if (next !== undefined) { event.preventDefault(); tabs[next].focus(); }
});
document.querySelectorAll('details').forEach(detail => detail.addEventListener('toggle', () => refresh()));

// Auto capture deliberately skips BUTTON subtrees. Keep native plate controls
// intact and add their photos through the official viewport-space painter API.
function paintStudioPhotos(context, region) {
  if (document.body.dataset.view !== 'studio' || document.body.classList.contains('viewer-open')) return;
  // Query each frame: All creates/removes loop clones when filters/width change.
  for (const img of document.querySelectorAll('.studio-board .plate img')) {
    if (!img.complete || !img.naturalWidth) continue;
    const box = img.getBoundingClientRect();
    if (!box.width || !box.height || box.right <= region.x || box.left >= region.x + region.width
      || box.bottom <= region.y || box.top >= region.y + region.height) continue;
    context.save();
    let opacity = 1;
    for (let node = img; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') { opacity = 0; break; }
      opacity *= Number(style.opacity);
      if (node === img || /(hidden|clip|auto|scroll)/.test(`${style.overflowX} ${style.overflowY}`)) {
        const clip = node.getBoundingClientRect();
        context.beginPath();
        context.rect(clip.x, clip.y, clip.width, clip.height);
        context.clip();
      }
    }
    context.globalAlpha *= opacity;
    // Match the existing centered object-fit: cover and All-rail focus blur.
    context.filter = getComputedStyle(img).filter;
    const scale = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight);
    const width = img.naturalWidth * scale, height = img.naturalHeight * scale;
    context.drawImage(img, box.x + (box.width - width) / 2, box.y + (box.height - height) / 2, width, height);
    context.restore();
  }
}

const material = {
  // DOM LiquidGlass uses the V2 optical material, not the V1 string presets.
  // Keep the paper/content clear, with only a restrained refractive rim.
  refraction: 84, edgeReach: .14, edgeWidth: .21, dispersion: 2,
  frost: 0, backdropBlur: 0, tint: 0, body: 0, absorption: 0,
  rim: .24, reflection: .31, highlight: .34,
  echo: .28, hairline: .92, hairWidth: .52,
};
resize();
for (const element of [dock, selection]) {
  lenses.push(new LiquidGlass(element, {
    backdrop: ['auto', paintStudioPhotos], tint: 0, frost: 0, material,
    // Repaint the auto backdrop every visible frame, including pill movement.
    live: true, maxDpr: 2,
  }));
}
let animationFrame;
function followTransition() {
  cancelAnimationFrame(animationFrame);
  const until = performance.now() + (reduced.matches ? 0 : 420);
  function tick() {
    refresh();
    if (performance.now() < until) animationFrame = requestAnimationFrame(tick);
  }
  tick();
}
dock.addEventListener('click', followTransition);
document.querySelectorAll('details').forEach(el => el.addEventListener('toggle', followTransition));
addEventListener('resize', resize);
addEventListener('scroll', refresh, { passive: true });
addEventListener('hashchange', () => navigate(location.hash.slice(1)));

const initial = aliases[location.hash.slice(1)] || location.hash.slice(1);
if (views.includes(initial)) navigate(initial, false);

await Promise.all(lenses.map(lens => lens.ready));
document.documentElement.dataset.glassReady = 'true';

function setupStudio() {
  const board = document.querySelector('.studio-board');
  const rows = [...document.querySelectorAll('.studio-row')];
  const plates = [...document.querySelectorAll('.plate')];
  const filters = [...document.querySelectorAll('.filter')];
  const tracks = [...document.querySelectorAll('.studio-row .row-track')];
  const viewer = document.querySelector('.viewer');
  const kindEl = document.querySelector('.viewer-kind');
  const copyEl = document.querySelector('.viewer-copy');
  const imageEl = document.querySelector('.viewer-image');
  const visible = () => plates.filter(plate => !plate.dataset.clone && !plate.closest('.studio-row').hidden);
  const motionOk = () => !reduced.matches;
  const gsap = window.gsap;
  let index = 0;
  let snapping = false;
  let wrapping = false;
  const settleTimers = new Map();

  function showPlate(plate) {
    kindEl.textContent = plate.dataset.label || '';
    const source = plate.querySelector('img');
    if (source) {
      imageEl.src = source.currentSrc || source.src;
      imageEl.alt = source.alt;
      imageEl.hidden = false;
      copyEl.hidden = true;
    } else {
      imageEl.removeAttribute('src');
      imageEl.alt = '';
      imageEl.hidden = true;
      copyEl.hidden = false;
      if (plate.dataset.kind === 'ai') copyEl.textContent = 'AI work coming soon.';
      else if (plate.dataset.kind === 'film') copyEl.textContent = 'Films coming soon.';
      else copyEl.textContent = 'Coming soon.';
    }
  }

  function activeTracks() {
    if (board.dataset.filter !== 'all') return [];
    return tracks.filter(track => !track.closest('.studio-row').hidden);
  }

  function originalsOf(track) {
    return [...track.querySelectorAll('.plate')].filter(plate => !plate.dataset.clone);
  }

  function setSpan(track) {
    const a = track.querySelector('.plate[data-copy="0"]');
    const b = track.querySelector('.plate[data-copy="1"]');
    if (a && b) return b.offsetLeft - a.offsetLeft;
    return Number(track.dataset.span) || 0;
  }

  function destroyLoop(track) {
    track.querySelectorAll('.plate[data-clone]').forEach(node => node.remove());
    delete track.dataset.copies;
    delete track.dataset.span;
    delete track.dataset.viewport;
    delete track.dataset.looped;
  }

  function bindClone(clone, origin) {
    clone.addEventListener('pointermove', event => {
      const box = clone.getBoundingClientRect();
      clone.style.setProperty('--mx', `${((event.clientX - box.left) / box.width) * 100}%`);
      clone.style.setProperty('--my', `${((event.clientY - box.top) / box.height) * 100}%`);
    });
    clone.addEventListener('click', () => openViewer(origin));
    clone.addEventListener('focus', () => {
      if (board.dataset.filter !== 'all' || !viewer.hidden) return;
      snapTrack(clone.closest('.row-track'), clone);
    });
  }

  function currentOrigin(track) {
    const plate = nearestPlate(track);
    const value = plate && plate.dataset.origin;
    return value === undefined ? 0 : Number(value);
  }

  function wrapTrack(track) {
    const span = Number(track.dataset.span) || setSpan(track);
    const copies = Number(track.dataset.copies) || 0;
    if (span <= 0 || copies < 3) return false;
    const plate = nearestPlate(track);
    if (!plate) return false;
    let copy = Number(plate.dataset.copy);
    if (Number.isNaN(copy)) return false;
    const mid = Math.floor(copies / 2);
    let x = track.scrollLeft;
    let shifted = false;
    while (copy < mid) {
      x += span;
      copy += 1;
      shifted = true;
    }
    while (copy > mid) {
      x -= span;
      copy -= 1;
      shifted = true;
    }
    if (shifted && Math.abs(x - track.scrollLeft) >= 1) {
      wrapping = true;
      if (gsap) gsap.killTweensOf(track);
      track.scrollLeft = x;
      wrapping = false;
      snapping = false;
      return true;
    }
    return false;
  }

  function buildLoop(track, keepIndex = 0) {
    const originals = originalsOf(track);
    if (!originals.length) return;
    track.style.paddingLeft = '0px';
    track.style.paddingRight = '0px';

    const reuse = track.dataset.looped === 'true'
      && Number(track.dataset.viewport) === track.clientWidth
      && Number(track.dataset.span) > 0;
    if (reuse) {
      wrapTrack(track);
      return;
    }

    destroyLoop(track);
    originals.forEach((plate, i) => {
      plate.dataset.origin = String(i);
    });

    const first = originals[0];
    const last = originals[originals.length - 1];
    const gap = parseFloat(getComputedStyle(track).gap) || 0;
    const span = (last.offsetLeft + last.offsetWidth) - first.offsetLeft + gap;
    let copies = 3;
    if (span > 0) {
      copies = Math.max(3, Math.ceil((track.clientWidth + 2 * span) / span));
      if (copies % 2 === 0) copies += 1;
    }
    const midCopy = Math.floor(copies / 2);
    const before = document.createDocumentFragment();
    const after = document.createDocumentFragment();
    for (let copy = 0; copy < copies; copy++) {
      if (copy === midCopy) continue;
      for (const plate of originals) {
        const clone = plate.cloneNode(true);
        clone.dataset.clone = 'true';
        clone.dataset.origin = plate.dataset.origin;
        clone.dataset.copy = String(copy);
        clone.tabIndex = -1;
        clone.setAttribute('aria-hidden', 'true');
        clone.classList.remove('is-focus');
        bindClone(clone, plate);
        (copy < midCopy ? before : after).append(clone);
      }
    }
    originals.forEach(plate => {
      plate.dataset.copy = String(midCopy);
    });
    track.prepend(before);
    track.append(after);
    track.dataset.copies = String(copies);
    track.dataset.span = String(span);
    track.dataset.viewport = String(track.clientWidth);
    track.dataset.looped = 'true';

    const index = Math.max(0, Math.min(originals.length - 1, keepIndex));
    const target = track.querySelector(`.plate[data-copy="${midCopy}"][data-origin="${index}"]`) || originals[index];
    if (target) track.scrollLeft = targetScroll(track, target);
    wrapTrack(track);
  }

  function paintTrack(track) {
    const mid = track.getBoundingClientRect().left + track.clientWidth / 2;
    for (const plate of track.querySelectorAll('.plate')) {
      if (!motionOk()) {
        plate.style.setProperty('--rail-o', '1');
        plate.style.setProperty('--rail-blur', '0px');
        plate.style.setProperty('--rail-scale', '1');
        plate.classList.add('is-focus');
        continue;
      }
      const box = plate.getBoundingClientRect();
      const dist = Math.abs(box.left + box.width / 2 - mid);
      const t = Math.min(1, dist / Math.max(box.width * 0.9, 1));
      const e = t * t * (3 - 2 * t);
      plate.style.setProperty('--rail-o', String(1 - e * 0.62));
      plate.style.setProperty('--rail-blur', `${(e * 8).toFixed(2)}px`);
      plate.style.setProperty('--rail-scale', String(1 - e * 0.08));
      plate.classList.toggle('is-focus', t < 0.35);
    }
  }

  function targetScroll(track, plate) {
    const trackBox = track.getBoundingClientRect();
    const plateBox = plate.getBoundingClientRect();
    const delta = (plateBox.left + plateBox.width / 2) - (trackBox.left + track.clientWidth / 2);
    return track.scrollLeft + delta;
  }

  function nearestPlate(track) {
    const mid = track.getBoundingClientRect().left + track.clientWidth / 2;
    let best = null;
    let bestDist = Infinity;
    for (const plate of track.querySelectorAll('.plate')) {
      const box = plate.getBoundingClientRect();
      const d = Math.abs(box.left + box.width / 2 - mid);
      if (d < bestDist) {
        bestDist = d;
        best = plate;
      }
    }
    return best;
  }

  function snapTrack(track, plate, duration) {
    wrapTrack(track);
    const target = plate || nearestPlate(track);
    if (!target) return;
    const x = targetScroll(track, target);
    const time = duration ?? (motionOk() ? 0.55 : 0);
    if (Math.abs(x - track.scrollLeft) < 1) {
      paintTrack(track);
      return;
    }
    if (!gsap || time === 0) {
      track.scrollLeft = x;
      wrapTrack(track);
      paintTrack(track);
      return;
    }
    snapping = true;
    gsap.to(track, {
      scrollLeft: x,
      duration: time,
      ease: 'power3.out',
      overwrite: true,
      onUpdate: () => paintTrack(track),
      onComplete: () => {
        snapping = false;
        wrapTrack(track);
        paintTrack(track);
      },
    });
  }

  function clearRails() {
    for (const track of tracks) {
      if (gsap) gsap.killTweensOf(track);
      destroyLoop(track);
      track.style.paddingLeft = '';
      track.style.paddingRight = '';
      for (const plate of track.querySelectorAll('.plate')) {
        plate.style.removeProperty('--rail-o');
        plate.style.removeProperty('--rail-blur');
        plate.style.removeProperty('--rail-scale');
        plate.classList.remove('is-focus');
      }
    }
    snapping = false;
  }

  function syncRails(animate = false) {
    if (board.dataset.filter !== 'all') {
      clearRails();
      return;
    }
    for (const track of activeTracks()) {
      buildLoop(track, currentOrigin(track));
      paintTrack(track);
      if (animate) snapTrack(track, nearestPlate(track), motionOk() ? 0.45 : 0);
    }
  }

  const hasScrollEnd = 'onscrollend' in window;
  function scheduleSnap(track) {
    clearTimeout(settleTimers.get(track));
    settleTimers.set(track, setTimeout(() => {
      if (!snapping && board.dataset.filter === 'all') snapTrack(track);
    }, 160));
  }

  function setFilter(kind) {
    for (const filter of filters) {
      const on = filter.dataset.filter === kind;
      filter.classList.toggle('is-on', on);
      filter.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    for (const row of rows) {
      row.hidden = kind === 'all' ? row.dataset.row === 'ai' : row.dataset.row !== kind;
    }
    board.dataset.filter = kind;
    requestAnimationFrame(() => {
      syncRails(false);
      refresh();
    });
  }

  function openViewer(from) {
    const items = visible();
    index = Math.max(0, items.indexOf(from));
    const plate = items[index];
    if (!plate) return;
    showPlate(plate);
    viewer.hidden = false;
    viewer.removeAttribute('inert');
    document.body.classList.add('viewer-open');
    document.querySelector('.viewer-close').focus();
    followTransition();
  }
  function closeViewer() {
    if (viewer.hidden) return;
    const items = visible();
    const source = items[index];
    viewer.hidden = true;
    viewer.setAttribute('inert', '');
    document.body.classList.remove('viewer-open');
    if (source) source.focus();
    followTransition();
  }
  function step(delta) {
    const items = visible();
    if (!items.length) return;
    index = (index + delta + items.length) % items.length;
    showPlate(items[index]);
  }

  for (const filter of filters) filter.addEventListener('click', () => setFilter(filter.dataset.filter));
  for (const plate of plates) {
    plate.addEventListener('pointermove', event => {
      const box = plate.getBoundingClientRect();
      plate.style.setProperty('--mx', `${((event.clientX - box.left) / box.width) * 100}%`);
      plate.style.setProperty('--my', `${((event.clientY - box.top) / box.height) * 100}%`);
    });
    plate.addEventListener('click', () => openViewer(plate));
    plate.addEventListener('focus', () => {
      if (board.dataset.filter !== 'all' || !viewer.hidden) return;
      const track = plate.closest('.row-track');
      if (track) snapTrack(track, plate);
    });
  }
  document.querySelector('.viewer-close').addEventListener('click', closeViewer);
  document.querySelector('.viewer-prev').addEventListener('click', () => step(-1));
  document.querySelector('.viewer-next').addEventListener('click', () => step(1));
  viewer.addEventListener('click', event => { if (event.target === viewer) closeViewer(); });
  addEventListener('keydown', event => {
    if (document.body.dataset.view !== 'studio') return;
    if (event.key === 'Escape') closeViewer();
    if (viewer.hidden) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
  });

  for (const track of tracks) {
    track.addEventListener('scroll', () => {
      if (board.dataset.filter !== 'all' || wrapping) return;
      wrapTrack(track);
      paintTrack(track);
      if (!hasScrollEnd && !snapping) scheduleSnap(track);
    }, { passive: true });
    track.addEventListener('scrollend', () => {
      if (wrapping || snapping || board.dataset.filter !== 'all') return;
      wrapTrack(track);
      snapTrack(track);
    });
  }
  for (const img of board.querySelectorAll('img')) {
    if (!img.complete) img.addEventListener('load', () => syncRails(false), { once: true });
  }
  addEventListener('resize', () => syncRails(false));
  syncRails(false);
}
setupStudio();
