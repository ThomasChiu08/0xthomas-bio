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
function refresh() { paintPaper(); LiquidGlass.refreshAll(); updateTabInk(); }
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
  watchTabInk();
  document.dispatchEvent(new Event('viewchange'));
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
function paintMedia(context, region, img) {
  if (!img || img.hidden || !img.complete || !img.naturalWidth) return;
  const box = img.getBoundingClientRect();
  if (!box.width || !box.height || box.right <= region.x || box.left >= region.x + region.width
    || box.bottom <= region.y || box.top >= region.y + region.height) return;
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
  context.filter = getComputedStyle(img).filter;
  const scale = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight);
  const width = img.naturalWidth * scale, height = img.naturalHeight * scale;
  context.drawImage(img, box.x + (box.width - width) / 2, box.y + (box.height - height) / 2, width, height);
  context.restore();
}

function paintStudioPhotos(context, region) {
  if (document.body.classList.contains('viewer-open')) {
    paintMedia(context, region, document.querySelector('.viewer-image'));
    return;
  }
  if (document.body.dataset.view !== 'studio') return;
  // Paint back to front: the centered sleeve must win where covers overlap.
  const images = [...document.querySelectorAll('.studio-board .plate img')]
    .sort((a, b) => (Number(a.parentElement.style.zIndex) || 0) - (Number(b.parentElement.style.zIndex) || 0));
  for (const img of images) {
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
    // Keep sampling the transformed viewport bounds, including under the dock.
    context.filter = getComputedStyle(img).filter;
    const scale = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight);
    const width = img.naturalWidth * scale, height = img.naturalHeight * scale;
    context.drawImage(img, box.x + (box.width - width) / 2, box.y + (box.height - height) / 2, width, height);
    context.restore();
  }
}


const contrast = document.createElement('canvas');
const contrastCtx = contrast.getContext('2d', { willReadFrequently: true });
const reducedTransparency = matchMedia('(prefers-reduced-transparency: reduce)');
const tabInk = new WeakMap();
let tabInkFrame;

function updateTabInk() {
  if (reducedTransparency.matches) {
    for (const tab of tabs) {
      tab.removeAttribute('data-ink');
      tabInk.delete(tab);
    }
    return;
  }
  const dockBox = dock.getBoundingClientRect();
  const width = Math.max(1, Math.round(dockBox.width));
  const height = Math.max(1, Math.round(dockBox.height));
  if (contrast.width !== width || contrast.height !== height) {
    contrast.width = width;
    contrast.height = height;
  }
  contrastCtx.setTransform(1, 0, 0, 1, 0, 0);
  contrastCtx.fillStyle = '#f8f7f3';
  contrastCtx.fillRect(0, 0, width, height);
  if (paper.width && paper.height) {
    const dpr = paper.width / innerWidth;
    contrastCtx.drawImage(
      paper,
      dockBox.x * dpr, dockBox.y * dpr, dockBox.width * dpr, dockBox.height * dpr,
      0, 0, width, height
    );
  }
  contrastCtx.setTransform(1, 0, 0, 1, -dockBox.x, -dockBox.y);
  paintStudioPhotos(contrastCtx, dockBox);
  contrastCtx.setTransform(1, 0, 0, 1, 0, 0);
  let pixels;
  try { pixels = contrastCtx.getImageData(0, 0, width, height).data; }
  catch { return; }
  for (const tab of tabs) {
    const box = tab.getBoundingClientRect();
    const x0 = Math.max(0, Math.floor(box.x - dockBox.x));
    const y0 = Math.max(0, Math.floor(box.y - dockBox.y));
    const x1 = Math.min(width, Math.ceil(box.x + box.width - dockBox.x));
    const y1 = Math.min(height, Math.ceil(box.y + box.height - dockBox.y));
    let luma = 0, count = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4;
        luma += 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
        count++;
      }
    }
    const average = count ? luma / (count * 255) : 0.97;
    const previous = tabInk.get(tab);
    const ink = previous === 'light'
      ? (average > 0.62 ? 'dark' : 'light')
      : (average < 0.48 ? 'light' : 'dark');
    tabInk.set(tab, ink);
    if (ink === 'light') tab.dataset.ink = 'light';
    else tab.removeAttribute('data-ink');
  }
}

function watchTabInk() {
  cancelAnimationFrame(tabInkFrame);
  function tick() {
    updateTabInk();
    const liveInk = document.body.dataset.view === 'studio' || document.body.classList.contains('viewer-open');
    if (liveInk && !reducedTransparency.matches) {
      tabInkFrame = requestAnimationFrame(tick);
    }
  }
  tick();
}
reducedTransparency.addEventListener('change', watchTabInk);

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
  const visible = () => plates.filter(plate => !plate.closest('.studio-row').hidden);
  const gsap = window.gsap;
  let index = 0;

  const audioRoot = document.querySelector('.viewer-audio');
  const audioToggle = document.querySelector('.viewer-audio-toggle');
  const volumeSlider = document.querySelector('.viewer-volume-slider');
  const progressSlider = document.querySelector('.viewer-progress-slider');
  const timeNow = document.querySelector('.viewer-time-now');
  const timeEnd = document.querySelector('.viewer-time-end');
  const player = document.querySelector('.viewer-player');
  const volumeKey = 'studio-audio-volume';
  let audioSrc = '';
  let scrubbing = false;

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const total = Math.floor(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }
  function readVolume() {
    const raw = localStorage.getItem(volumeKey);
    if (raw == null || raw === '') return 0.7;
    const stored = Number(raw);
    if (Number.isFinite(stored) && stored >= 0 && stored <= 1) return stored;
    return 0.7;
  }
  function applyVolume(value) {
    const next = Math.min(1, Math.max(0, Number(value)));
    if (!Number.isFinite(next)) return;
    if (player) player.volume = next;
    if (volumeSlider && Number(volumeSlider.value) !== next) volumeSlider.value = String(next);
    try { localStorage.setItem(volumeKey, String(next)); } catch {}
  }
  function resetProgress() {
    if (progressSlider) {
      progressSlider.value = '0';
      progressSlider.max = '0';
    }
    if (timeNow) timeNow.textContent = '0:00';
    if (timeEnd) timeEnd.textContent = '0:00';
  }
  function updateProgress() {
    if (!player || !progressSlider) return;
    const duration = player.duration;
    const current = player.currentTime || 0;
    if (Number.isFinite(duration) && duration > 0) {
      progressSlider.max = String(duration);
      if (!scrubbing) progressSlider.value = String(current);
      if (timeEnd) timeEnd.textContent = formatTime(duration);
    }
    if (timeNow) timeNow.textContent = formatTime(scrubbing ? Number(progressSlider.value) : current);
  }
  function seekTo(value) {
    const next = Number(value);
    if (!player || !Number.isFinite(next)) return;
    player.currentTime = Math.min(Number(progressSlider.max) || next, Math.max(0, next));
    if (timeNow) timeNow.textContent = formatTime(player.currentTime);
  }
  function setAudioToggle(playing) {
    if (!audioToggle) return;
    audioToggle.textContent = playing ? 'Pause' : 'Play';
    audioToggle.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
  }
  function toggleAudio() {
    if (!player || !audioSrc) return;
    if (player.paused) player.play().catch(() => setAudioToggle(false));
    else player.pause();
  }
  function stopAudio() {
    if (!player) return;
    player.pause();
    player.removeAttribute('src');
    player.load();
    audioSrc = '';
    scrubbing = false;
    if (audioRoot) audioRoot.hidden = true;
    setAudioToggle(false);
    resetProgress();
  }
  function syncAudio(plate) {
    if (!player || !audioRoot) return;
    const next = plate?.dataset.audio || '';
    if (!next) {
      stopAudio();
      return;
    }
    audioRoot.hidden = false;
    applyVolume(readVolume());
    if (audioSrc === next) {
      if (player.paused) player.play().catch(() => setAudioToggle(false));
      updateProgress();
      return;
    }
    audioSrc = next;
    player.src = next;
    player.currentTime = 0;
    resetProgress();
    player.play().catch(() => setAudioToggle(false));
  }
  if (player) {
    applyVolume(readVolume());
    player.addEventListener('play', () => setAudioToggle(true));
    player.addEventListener('pause', () => setAudioToggle(false));
    player.addEventListener('ended', () => { setAudioToggle(false); updateProgress(); });
    player.addEventListener('timeupdate', updateProgress);
    player.addEventListener('loadedmetadata', updateProgress);
    player.addEventListener('durationchange', updateProgress);
  }
  if (audioToggle) {
    audioToggle.addEventListener('click', event => {
      event.stopPropagation();
      toggleAudio();
    });
  }
  if (volumeSlider) {
    volumeSlider.addEventListener('input', () => applyVolume(volumeSlider.value));
    volumeSlider.addEventListener('pointerdown', event => event.stopPropagation());
  }
  if (progressSlider) {
    const endScrub = () => {
      if (!scrubbing) return;
      scrubbing = false;
      seekTo(progressSlider.value);
    };
    progressSlider.addEventListener('pointerdown', event => {
      event.stopPropagation();
      scrubbing = true;
    });
    progressSlider.addEventListener('input', () => {
      scrubbing = true;
      seekTo(progressSlider.value);
    });
    addEventListener('pointerup', endScrub);
    addEventListener('pointercancel', endScrub);
  }


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

  // One controller per row. No native horizontal scrolling, clones, or shared
  // gesture flags: GSAP only interpolates this deck's numeric index.
  function createDeck(track) {
    const items = [...track.querySelectorAll('.plate')];
    const row = track.closest('.studio-row');
    const loop = row.dataset.row === 'still';
    const count = items.length;
    const state = { index: 0 };
    let target = 0;
    let tween = null;
    let gesture = null;
    let wheelTimer = null;
    let suppressClickUntil = 0;
    const modulo = value => ((value % count) + count) % count;
    const limit = value => loop ? value : Math.max(0, Math.min(count - 1, value));
    const offsetOf = i => loop
      ? modulo(i - state.index + count / 2) - count / 2
      : i - state.index;
    const activeIndex = () => modulo(Math.round(state.index));
    let sleeping = false;
    const enabled = () => !sleeping && !row.hidden && viewer.hidden && document.body.dataset.view === 'studio';
    const focused = () => track === document.activeElement || track.contains(document.activeElement);
    const unit = () => Math.max(90, items[0].offsetWidth * .55);
    let hoverIndex = -1;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const modeFrom = pointerType => {
      if (pointerType === 'touch') return 'touch';
      if (pointerType === 'mouse' || pointerType === 'pen') return 'mouse';
      return finePointer.matches ? 'mouse' : 'touch';
    };
    const setInputMode = mode => { track.dataset.input = mode; };
    setInputMode(modeFrom());
    finePointer.addEventListener('change', () => { if (!gesture) setInputMode(modeFrom()); });

    track.classList.add('coverflow');
    track.tabIndex = -1;
    track.setAttribute('role', 'group');
    track.setAttribute('aria-roledescription', 'carousel');
    track.setAttribute('aria-label', row.getAttribute('aria-label'));
    track.setAttribute('aria-description', 'Use Left and Right arrows or drag to change covers. Scroll horizontally, or use the mouse wheel while focused. Activate the center cover to open it.');
    const position = document.createElement('p');
    position.className = 'deck-position sr-only';
    position.id = `position-${row.dataset.row}`;
    position.setAttribute('aria-live', 'polite');
    position.setAttribute('aria-atomic', 'true');
    row.append(position);
    for (const item of items) {
      item.setAttribute('aria-describedby', position.id);
      const img = item.querySelector('img');
      if (img) img.draggable = false;
    }

    function render() {
      const active = activeIndex();
      items.forEach((item, i) => {
        const offset = offsetOf(i);
        const distance = Math.abs(offset);
        // Interpolate the reference's signed side around zero, so crossing the
        // center is continuous. At distance >= 1 the sleeve is fully tilted.
        const side = Math.max(-1, Math.min(1, offset));
        const spread = Math.sign(offset) * Math.max(0, distance - 1);
        // Distance keeps growing past the first neighbor so edge covers sit
        // farther back and read as the smallest plates in the perspective.
        const retreat = distance;
        const edge = Math.max(0, Math.min(1, (2.45 - distance) / .55));
        const dim = 1 - Math.min(.22, distance * .14);
        let opacity = edge * dim;
        const hover = i === hoverIndex && i !== active && opacity > 0;
        if (hover) opacity = Math.min(1, opacity + .1);
        const scale = reduced.matches ? 1 : 1 - Math.min(.3, distance * .15) + (hover ? .03 : 0);
        item.style.setProperty('--side', String(side));
        item.style.setProperty('--spread', String(spread));
        item.style.setProperty('--retreat', String(retreat));
        item.style.setProperty('--scale', String(scale));
        item.style.opacity = String(opacity);
        item.style.visibility = opacity === 0 ? 'hidden' : 'visible';
        item.style.zIndex = String(100 - Math.round(distance * 10) + (hover ? 2 : 0));
        item.tabIndex = i === active ? 0 : -1;
        item.classList.toggle('is-focus', i === active);
        if (i === active) item.setAttribute('aria-current', 'true');
        else item.removeAttribute('aria-current');
      });
    }

    function stopTween() {
      tween?.kill();
      tween = null;
      clearTimeout(wheelTimer);
      wheelTimer = null;
    }

    function finish(focus) {
      // Rebase only after settlement. Modulo leaves all visual offsets intact.
      state.index = loop ? modulo(Math.round(state.index)) : limit(Math.round(state.index));
      target = state.index;
      tween = null;
      render();
      position.textContent = `${String(activeIndex() + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`;
      if (focus && enabled() && focused()) items[activeIndex()].focus({ preventScroll: true });
    }

    function settle(value = state.index, { focus = false, instant = false } = {}) {
      stopTween();
      target = limit(Math.round(value));
      if (!gsap || reduced.matches || instant || Math.abs(target - state.index) < .001) {
        state.index = target;
        finish(focus);
        return;
      }
      tween = gsap.to(state, {
        index: target,
        duration: .32 + Math.min(.28, Math.abs(target - state.index) * .07),
        ease: 'power3.out',
        overwrite: true,
        onUpdate: render,
        onComplete: () => finish(focus),
      });
    }

    function releaseCapture() {
      const previous = gesture;
      gesture = null;
      track.classList.remove('is-dragging');
      if (previous && track.hasPointerCapture(previous.id)) track.releasePointerCapture(previous.id);
      return previous;
    }

    function reset() {
      if (sleeping) return;
      if (gesture?.dragging) suppressClickUntil = performance.now() + 400;
      releaseCapture();
      settle(state.index, { instant: true });
    }

    function clearPlateMotion(item) {
      item.style.removeProperty('--side');
      item.style.removeProperty('--spread');
      item.style.removeProperty('--retreat');
      item.style.removeProperty('--scale');
      item.style.opacity = '';
      item.style.visibility = '';
      item.style.zIndex = '';
      item.style.transform = '';
      item.classList.remove('is-focus', 'is-hover', 'is-feature', 'is-page', 'is-entering');
    }

    function sleep() {
      if (sleeping) return;
      sleeping = true;
      stopTween();
      releaseCapture();
      hoverIndex = -1;
      track.classList.remove('coverflow', 'is-dragging');
      track.removeAttribute('data-input');
      items.forEach(clearPlateMotion);
    }

    function wake() {
      if (!sleeping && track.classList.contains('coverflow')) {
        settle(state.index, { instant: true });
        return;
      }
      sleeping = false;
      track.classList.add('coverflow');
      setInputMode(modeFrom());
      items.forEach(clearPlateMotion);
      settle(state.index, { instant: true });
    }

    function select(item, instant = false) {
      const i = items.indexOf(item);
      if (i < 0) return;
      releaseCapture();
      settle(state.index + offsetOf(i), { instant, focus: true });
    }

    track.addEventListener('pointerdown', event => {
      if (!enabled() || !event.isPrimary || event.button !== 0 || gesture) return;
      setInputMode(modeFrom(event.pointerType));
      hoverIndex = -1;
      stopTween();
      target = state.index;
      suppressClickUntil = 0;
      gesture = {
        id: event.pointerId, x: event.clientX, y: event.clientY,
        start: state.index, unit: unit(), lastX: event.clientX,
        time: event.timeStamp, velocity: 0, dragging: false,
      };
    });

    track.addEventListener('pointermove', event => {
      if (!gesture || gesture.id !== event.pointerId) {
        if (!gesture && event.pointerType !== 'touch') {
          const item = event.target.closest('.plate');
          const next = item ? items.indexOf(item) : -1;
          if (next !== hoverIndex) {
            hoverIndex = next;
            render();
          }
        }
        return;
      }
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (!gesture.dragging) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 7) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          releaseCapture();
          settle();
          return; // Keep vertical touch panning native.
        }
        gesture.dragging = true;
        track.setPointerCapture(event.pointerId);
        track.classList.add('is-dragging');
        track.focus({ preventScroll: true });
      }
      event.preventDefault();
      const elapsed = Math.max(8, event.timeStamp - gesture.time);
      const velocity = (gesture.lastX - event.clientX) / gesture.unit / elapsed;
      gesture.velocity = elapsed > 90 ? velocity : .35 * gesture.velocity + .65 * velocity;
      gesture.lastX = event.clientX;
      gesture.time = event.timeStamp;
      state.index = limit(gesture.start - dx / gesture.unit);
      target = state.index;
      render();
    });

    function endPointer(event, cancelled = false) {
      if (!gesture || gesture.id !== event.pointerId) return;
      const previous = releaseCapture();
      if (previous.dragging) suppressClickUntil = performance.now() + 400;
      const velocity = !cancelled && event.timeStamp - previous.time < 90 ? previous.velocity : 0;
      const travel = reduced.matches ? 0 : Math.max(-3, Math.min(3, velocity * 180));
      settle(state.index + travel, { focus: previous.dragging });
    }
    track.addEventListener('pointerup', event => endPointer(event));
    track.addEventListener('pointercancel', event => endPointer(event, true));
    track.addEventListener('lostpointercapture', event => endPointer(event, true));
    track.addEventListener('pointerleave', event => {
      if (gesture && !gesture.dragging) endPointer(event, true);
      if (hoverIndex !== -1) {
        hoverIndex = -1;
        render();
      }
    });
    track.addEventListener('dragstart', event => event.preventDefault());

    track.addEventListener('wheel', event => {
      if (!enabled() || gesture || event.ctrlKey || event.metaKey) return;
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      // Vertical page scrolling stays available until the user focuses a deck.
      if (!horizontal && !event.shiftKey && !focused()) return;
      const delta = horizontal ? event.deltaX : event.deltaY;
      if (!delta) return;
      if (!loop && ((state.index <= 0 && delta < 0) || (state.index >= count - 1 && delta > 0))) return;
      event.preventDefault();
      stopTween();
      const scale = event.deltaMode === 1 ? unit() * .35 : event.deltaMode === 2 ? unit() : 1;
      state.index = limit(state.index + Math.max(-2, Math.min(2, delta * scale / unit())));
      target = state.index;
      // Keep focus on the deck while its former centered button moves away.
      if (focused()) track.focus({ preventScroll: true });
      render();
      wheelTimer = setTimeout(() => settle(state.index, { focus: true }), 140);
    }, { passive: false });

    track.addEventListener('keydown', event => {
      if (!enabled() || event.altKey || event.ctrlKey || event.metaKey) return;
      let next;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const pending = Math.sign(target - state.index);
        const base = pending && pending !== direction ? state.index : target;
        next = Math.round(base) + direction;
      }
      else if (event.key === 'Home') next = state.index + offsetOf(0);
      else if (event.key === 'End') next = state.index + offsetOf(count - 1);
      else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!event.repeat) openViewer(items[activeIndex()]);
        return;
      } else return;
      event.preventDefault();
      releaseCapture();
      track.focus({ preventScroll: true });
      // Bound queued key-repeat travel, while retaining immediate reversals.
      if (event.key.startsWith('Arrow')) next = Math.max(state.index - 3, Math.min(state.index + 3, next));
      settle(next, { focus: true });
    });

    track.addEventListener('click', event => {
      if (!enabled()) return;
      event.preventDefault();
      if (event.detail && performance.now() < suppressClickUntil) return;
      const item = event.target.closest('.plate');
      track.focus({ preventScroll: true });
      if (!item) return;
      const i = items.indexOf(item);
      if (i === activeIndex() && Math.abs(state.index - Math.round(state.index)) < .001) openViewer(item);
      else select(item);
    });
    finish(false);
    return { reset, select, sleep, wake, contains: item => items.includes(item) };
  }


function setupStillsLayouts(track, deck) {
  const row = track.closest('.studio-row');
  const board = document.querySelector('.studio-board');
  const items = [...track.querySelectorAll('.plate')];
  const switcher = document.querySelector('.still-layouts');
  const buttons = [...document.querySelectorAll('.still-layout')];
  const gsap = window.gsap;
  let mode = 'magazine';
  let featured = items[0];
  let page = 0;
  let rail = null;
  let stage = null;
  let turning = false;
  let bookGesture = null;

  function layoutName() {
    return board.dataset.filter === 'still' ? (board.dataset.stillLayout || 'magazine') : '';
  }

  function clearBookChrome() {
    if (stage) {
      items.forEach(item => track.append(item));
      stage.remove();
      stage = null;
    }
    rail?.remove();
    rail = null;
    items.forEach(item => {
      item.classList.remove('is-page', 'is-entering', 'is-feature');
      item.style.clipPath = '';
      item.style.webkitClipPath = '';
      gsap?.set(item, { clearProps: 'transform,transformOrigin,clipPath,opacity,x,y,scale,scaleX,scaleY' });
    });
  }

  function applyMagazine(instant = true) {
    clearBookChrome();
    board.dataset.stillLayout = 'magazine';
    if (!featured || !items.includes(featured)) featured = items[0];
    items.forEach(item => {
      item.classList.toggle('is-feature', item === featured);
      item.tabIndex = 0;
    });
    track.setAttribute('aria-roledescription', 'gallery');
    track.setAttribute('aria-description', 'A magazine grid. Activate a still to bring it forward. Activate the large still to open it.');
  }

  function flipTo(next, instant = false) {
    if (!next || !items.includes(next)) return;
    if (next === featured) {
      openViewer(next);
      return;
    }
    const first = new Map(items.map(item => [item, item.getBoundingClientRect()]));
    featured = next;
    items.forEach(item => item.classList.toggle('is-feature', item === featured));
    if (instant || !gsap || reduced.matches) return;
    items.forEach(item => {
      const a = first.get(item);
      const b = item.getBoundingClientRect();
      const sx = a.width / Math.max(1, b.width);
      const sy = a.height / Math.max(1, b.height);
      gsap.fromTo(item, {
        x: a.left - b.left,
        y: a.top - b.top,
        scaleX: sx,
        scaleY: sy,
        transformOrigin: '0 0',
      }, {
        x: 0, y: 0, scaleX: 1, scaleY: 1,
        duration: .72,
        ease: 'power3.inOut',
        overwrite: true,
        onComplete: () => { gsap.set(item, { clearProps: 'transform,transformOrigin' }); },
      });
    });
  }

  function buildBook() {
    if (stage) return;
    stage = document.createElement('div');
    stage.className = 'book-stage';
    rail = document.createElement('div');
    rail.className = 'book-rail';
    rail.setAttribute('role', 'tablist');
    rail.setAttribute('aria-label', 'Stills in this book');
    items.forEach((item, i) => {
      stage.append(item);
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'book-thumb';
      thumb.dataset.index = String(i);
      thumb.setAttribute('role', 'tab');
      thumb.setAttribute('aria-label', item.getAttribute('aria-label') || `Still ${i + 1}`);
      const src = item.querySelector('img');
      if (src) {
        const img = document.createElement('img');
        img.src = src.currentSrc || src.src;
        img.alt = '';
        thumb.append(img);
      }
      thumb.addEventListener('click', () => turnTo(i));
      rail.append(thumb);
    });
    track.append(stage, rail);
  }

  function syncThumbs() {
    if (!rail) return;
    [...rail.children].forEach((thumb, i) => {
      const on = i === page;
      thumb.classList.toggle('is-on', on);
      thumb.setAttribute('aria-selected', on ? 'true' : 'false');
      thumb.tabIndex = on ? 0 : -1;
    });
  }

  function turnTo(index, instant = false, fromClick = false) {
    const count = items.length;
    const next = ((index % count) + count) % count;
    if (next === page && !instant && fromClick) {
      openViewer(items[page]);
      return;
    }
    if (next === page && !instant) return;
    const prev = page;
    const prevPlate = items[prev];
    const nextPlate = items[next];
    page = next;
    featured = nextPlate;
    syncThumbs();
    if (instant || !gsap || reduced.matches || prev === next) {
      items.forEach(item => {
        item.classList.toggle('is-page', item === nextPlate);
        item.classList.remove('is-entering');
        item.style.clipPath = '';
        gsap?.set(item, { clearProps: 'transform,clipPath' });
      });
      return;
    }
    if (turning) gsap.killTweensOf(items);
    turning = true;
    const forward = (next - prev + count) % count <= count / 2;
    const hidden = forward ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)';
    items.forEach(item => item.classList.remove('is-entering'));
    prevPlate.classList.add('is-page');
    nextPlate.classList.add('is-entering');
    gsap.set(nextPlate, { clipPath: hidden, x: forward ? 28 : -28 });
    gsap.timeline({
      defaults: { ease: 'power3.inOut' },
      onComplete: () => {
        items.forEach(item => {
          item.classList.toggle('is-page', item === nextPlate);
          item.classList.remove('is-entering');
        });
        gsap.set(nextPlate, { clearProps: 'transform,clipPath' });
        turning = false;
      },
    })
      .to(nextPlate, { clipPath: 'inset(0 0% 0 0%)', x: 0, duration: .72 }, 0)
      .to(prevPlate, { x: forward ? -18 : 18, duration: .72 }, 0);
  }

  function applyBook(instant = true) {
    board.dataset.stillLayout = 'book';
    buildBook();
    page = Math.max(0, items.indexOf(featured));
    if (page < 0) page = 0;
    featured = items[page];
    turnTo(page, true);
    track.setAttribute('aria-roledescription', 'photobook');
    track.setAttribute('aria-description', 'A photobook. Use arrows, swipe, or the thumbnails to turn pages. Activate the open page to view it.');
    track.tabIndex = 0;
  }

  function releaseBookGesture() {
    const previous = bookGesture;
    bookGesture = null;
    if (previous && stage?.hasPointerCapture(previous.id)) stage.releasePointerCapture(previous.id);
    return previous;
  }

  function onBookPointerDown(event) {
    if (layoutName() !== 'book' || !event.isPrimary || event.button !== 0 || bookGesture) return;
    bookGesture = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
  }
  function onBookPointerMove(event) {
    if (!bookGesture || bookGesture.id !== event.pointerId) return;
    const dx = event.clientX - bookGesture.x;
    const dy = event.clientY - bookGesture.y;
    if (!bookGesture.dragging) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) { releaseBookGesture(); return; }
      bookGesture.dragging = true;
      stage.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
  }
  function onBookPointerUp(event) {
    if (!bookGesture || bookGesture.id !== event.pointerId) return;
    const previous = releaseBookGesture();
    const dx = event.clientX - previous.x;
    if (!previous.dragging || Math.abs(dx) < 36) return;
    turnTo(page + (dx < 0 ? 1 : -1));
  }

  track.addEventListener('click', event => {
    if (board.dataset.filter !== 'still') return;
    const item = event.target.closest('.plate');
    if (!item || !items.includes(item)) return;
    event.preventDefault();
    event.stopPropagation();
    if (mode === 'magazine') flipTo(item);
    else if (mode === 'book') turnTo(items.indexOf(item), false, true);
  });
  track.addEventListener('keydown', event => {
    if (board.dataset.filter !== 'still' || event.altKey || event.ctrlKey || event.metaKey) return;
    if (mode !== 'book') return;
    if (event.key === 'ArrowRight') { event.preventDefault(); turnTo(page + 1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); turnTo(page - 1); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openViewer(items[page]); }
  });

  // Book gestures live on the stage once it exists; bind on the track as well
  // so a newly created stage still receives bubbled pointer events.
  track.addEventListener('pointerdown', event => {
    if (event.target.closest('.book-stage, .book-stage *') || event.target.classList.contains('book-stage') || event.target.closest('.plate') && mode === 'book') {
      onBookPointerDown(event);
    }
  });
  track.addEventListener('pointermove', onBookPointerMove);
  track.addEventListener('pointerup', onBookPointerUp);
  track.addEventListener('pointercancel', event => {
    if (bookGesture && bookGesture.id === event.pointerId) releaseBookGesture();
  });

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const next = button.dataset.stillLayout;
      if (next === mode) return;
      mode = next;
      for (const item of buttons) {
        const on = item.dataset.stillLayout === mode;
        item.classList.toggle('is-on', on);
        item.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      sync(true);
    });
  }

  function sync(fromSwitch = false) {
    const active = board.dataset.filter === 'still';
    switcher.hidden = !active;
    if (!active) {
      clearBookChrome();
      board.removeAttribute('data-still-layout');
      items.forEach(item => item.classList.remove('is-feature', 'is-page', 'is-entering'));
      deck?.wake();
      return;
    }
    deck?.sleep();
    board.dataset.stillLayout = mode;
    if (mode === 'book') applyBook(!fromSwitch);
    else applyMagazine(!fromSwitch);
    requestAnimationFrame(() => refresh());
  }

  function reveal(plate, instant = true) {
    if (!items.includes(plate)) return;
    featured = plate;
    page = items.indexOf(plate);
    if (mode === 'book') turnTo(page, instant);
    else {
      items.forEach(item => item.classList.toggle('is-feature', item === featured));
    }
  }

  return { sync, reveal };
}

  const decks = tracks.filter(track => track.closest('.studio-row').dataset.row !== 'ai').map(createDeck);
  const resetDecks = () => decks.forEach(deck => deck.reset());
  const stillsTrack = document.querySelector('.studio-row[data-row="still"] .row-track');
  const stillsDeck = decks.find(deck => deck.contains(stillsTrack.querySelector('.plate')));
  const stillsLayouts = setupStillsLayouts(stillsTrack, stillsDeck);
  reduced.addEventListener('change', resetDecks);
  addEventListener('resize', resetDecks);
  addEventListener('blur', resetDecks);
  document.addEventListener('viewchange', resetDecks);
  document.addEventListener('visibilitychange', () => { if (document.hidden) resetDecks(); });

  function setFilter(kind) {
    resetDecks();
    for (const filter of filters) {
      const on = filter.dataset.filter === kind;
      filter.classList.toggle('is-on', on);
      filter.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    for (const row of rows) {
      row.hidden = kind === 'all' ? row.dataset.row === 'ai' : row.dataset.row !== kind;
    }
    board.dataset.filter = kind;
    stillsLayouts.sync();
    requestAnimationFrame(() => {
      refresh();
    });
  }

  function openViewer(from) {
    resetDecks();
    const items = visible();
    index = Math.max(0, items.indexOf(from));
    const plate = items[index];
    if (!plate) return;
    showPlate(plate);
    syncAudio(plate);
    viewer.hidden = false;
    viewer.removeAttribute('inert');
    document.body.classList.add('viewer-open');
    document.querySelector('#studio').inert = true;
    dock.inert = false;
    document.querySelector('.viewer-close').focus();
    followTransition();
  }
  function closeViewer() {
    if (viewer.hidden) return;
    stopAudio();
    const items = visible();
    const source = items[index];
    viewer.hidden = true;
    viewer.setAttribute('inert', '');
    document.body.classList.remove('viewer-open');
    document.querySelector('#studio').inert = document.body.dataset.view !== 'studio';
    dock.inert = false;
    if (source) {
      if (board.dataset.filter === 'still') stillsLayouts.reveal(source, true);
      else decks.find(deck => deck.contains(source))?.select(source, true);
      source.focus({ preventScroll: true });
    }
    followTransition();
  }
  function step(delta) {
    const items = visible();
    if (!items.length) return;
    index = (index + delta + items.length) % items.length;
    showPlate(items[index]);
    syncAudio(items[index]);
  }

  for (const filter of filters) filter.addEventListener('click', () => setFilter(filter.dataset.filter));
  for (const plate of plates.filter(plate => plate.dataset.kind === 'ai')) {
    plate.addEventListener('click', () => openViewer(plate));
  }
  document.addEventListener('viewchange', () => { if (!viewer.hidden) closeViewer(); });
  document.querySelector('.viewer-close').addEventListener('click', closeViewer);
  document.querySelector('.viewer-prev').addEventListener('click', () => step(-1));
  document.querySelector('.viewer-next').addEventListener('click', () => step(1));
  viewer.addEventListener('click', event => { if (event.target === viewer) closeViewer(); });
  addEventListener('keydown', event => {
    if (document.body.dataset.view !== 'studio') return;
    if (event.key === 'Escape') closeViewer();
    if (viewer.hidden) return;
    if (event.target.closest?.('.viewer-volume-slider, .viewer-progress-slider')) return;
    if (event.key === ' ' || event.code === 'Space') { event.preventDefault(); toggleAudio(); }
    if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
  });

}
setupStudio();
watchTabInk();

await Promise.all(lenses.map(lens => lens.ready));
document.documentElement.dataset.glassReady = 'true';
