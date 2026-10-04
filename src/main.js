import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PROJECTS } from './projects.js';
import { showFallback } from './fallback.js';
import { createWorld, LEVELS, LEVEL_ORDER } from './world.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const params = new URLSearchParams(location.search);

/* ================= Quality settings ================= */
const coarse = matchMedia('(pointer: coarse)').matches;
const smallScreen = Math.min(innerWidth, innerHeight) < 600;
const cores = navigator.hardwareConcurrency || 4;
const mem = navigator.deviceMemory || 4;
function pickLevel() {
  const forced = params.get('q');
  if (forced && LEVELS[forced]) return forced;
  if (coarse || smallScreen) return cores <= 4 || mem <= 3 ? 'low' : 'medium';
  if (cores <= 4 || mem <= 4) return 'medium';
  return 'high';
}
let levelName = pickLevel();
const adaptive = params.get('adaptive') !== '0';

/* ================= Animations: on/off ================= */
const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
const stored = localStorage.getItem('universe-motion');
let animOn = stored ? stored === 'on' : !reduceMQ.matches;
const motionBtn = $('btn-motion');
function renderMotionBtn() {
  motionBtn.setAttribute('aria-pressed', String(animOn));
  $('btn-motion-text').textContent = animOn ? 'Анимации: вкл' : 'Анимации: выкл';
  document.body.classList.toggle('no-motion', !animOn);
}
motionBtn.addEventListener('click', () => {
  animOn = !animOn;
  localStorage.setItem('universe-motion', animOn ? 'on' : 'off');
  if (!animOn) controls && (controls.autoRotate = false);
  else if (controls) controls.autoRotate = state.mode === 'overview' || state.mode === 'focus';
  renderMotionBtn();
  needsRender = true;
});
reduceMQ.addEventListener?.('change', (e) => {
  if (localStorage.getItem('universe-motion')) return;
  animOn = !e.matches;
  renderMotionBtn();
  needsRender = true;
});
renderMotionBtn();

/* ================= Renderer ================= */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false,
    preserveDrawingBuffer: params.has('capture'),
  });
} catch (err) {
  showFallback(err);
}
if (!renderer || !renderer.getContext()) {
  if (renderer) showFallback('no context');
  throw new Error('WebGL unavailable');
}
renderer.setClearColor(0x03030a, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
stage.appendChild(renderer.domElement);
renderer.domElement.setAttribute('aria-label', 'Интерактивная 3D-сцена: Вселенная Shiren');
renderer.domElement.setAttribute('role', 'img');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 3000);
const world = createWorld(levelName);
scene.add(world.root);

/* ---- post-processing ---- */
let composer = null, bloom = null;
function buildComposer() {
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.6, 0.78);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  } catch (err) {
    console.warn('[universe] bloom off:', err);
    composer = null; bloom = null;
  }
}
buildComposer();

let dpr = 1;
function computeDpr() {
  const cap = LEVELS[levelName].dpr;
  const budget = levelName === 'low' ? 1.6e6 : 3.6e6;           // per-frame pixel "budget"
  const byBudget = Math.sqrt(budget / (innerWidth * innerHeight));
  return Math.max(0.75, Math.min(window.devicePixelRatio || 1, cap, byBudget));
}
function resize() {
  const w = innerWidth, h = innerHeight;
  dpr = computeDpr();
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + 'px';
  renderer.domElement.style.height = h + 'px';
  if (composer) { composer.setPixelRatio(dpr); composer.setSize(w, h); }
  world.uPx.value = dpr;
  camera.aspect = w / h;
  applyShift();
  camera.updateProjectionMatrix();
  needsRender = true;
}
let resizeRaf = 0;
addEventListener('resize', () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(resize); });

/* ================= Camera and controls ================= */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enablePan = false;
controls.rotateSpeed = 0.6;
controls.zoomSpeed = 0.8;
controls.minDistance = 14;
controls.maxDistance = 150;
controls.minPolarAngle = 0.15;
controls.maxPolarAngle = Math.PI - 0.15;
controls.autoRotateSpeed = 0.35;
controls.enabled = false;

const state = { mode: 'intro', focus: -1 };
let needsRender = true;
let idleTimer = 0;
controls.addEventListener('start', () => {
  controls.autoRotate = false;
  clearTimeout(idleTimer);
  document.body.classList.add('interacted');
});
controls.addEventListener('end', () => {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (animOn && (state.mode === 'overview' || state.mode === 'focus')) controls.autoRotate = true;
  }, 7000);
});
controls.addEventListener('change', () => { needsRender = true; });

const mobileLayout = () => innerWidth < 820 || innerWidth < innerHeight * 0.95;
function overviewPose() {
  const aspect = camera.aspect;
  const vfov = THREE.MathUtils.degToRad(55);
  const tanH = Math.tan(vfov / 2) * Math.min(aspect, 1.6);
  const dist = Math.max(50, 19 / tanH);
  const el = 0.3;
  return {
    pos: new THREE.Vector3(0, Math.sin(el) * dist, Math.cos(el) * dist),
    target: new THREE.Vector3(0, 0, 0),
  };
}

/* shift the frame so the planet does not hide behind the panel */
let shift = 0;
function applyShift() {
  const w = innerWidth, h = innerHeight;
  if (shift < 0.001) { camera.clearViewOffset(); return; }
  if (mobileLayout()) camera.setViewOffset(w, h, 0, h * 0.24 * shift, w, h);
  else camera.setViewOffset(w, h, w * 0.16 * shift, 0, w, h);
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/* ================= Panel and navigation ================= */
const panel = $('panel');
const nav = $('planet-nav');
const navBtns = [];
PROJECTS.forEach((p, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'nav-btn glass';
  const c = p.body.atmo.map((v) => Math.round(Math.min(1, v) * 255)).join(',');
  b.innerHTML = `<i style="--c:rgb(${c})"></i><span></span>`;
  b.querySelector('span').textContent = p.name;
  b.setAttribute('aria-label', `Лететь к планете: ${p.name}`);
  b.addEventListener('click', () => selectPlanet(i));
  b.addEventListener('pointerenter', () => setHover(i, false));
  b.addEventListener('pointerleave', () => setHover(-1, false));
  b.addEventListener('focus', () => setHover(i, false));
  b.addEventListener('blur', () => setHover(-1, false));
  nav.appendChild(b);
  navBtns.push(b);
});

function fillPanel(i) {
  const p = PROJECTS[i];
  $('panel-kicker').textContent = `Планета ${i + 1} из ${PROJECTS.length} · ${p.kind}`;
  $('panel-title').textContent = p.name;
  $('panel-desc').textContent = p.desc;
  const feats = $('panel-feats'); feats.innerHTML = '';
  p.feats.forEach((f) => { const li = document.createElement('li'); li.textContent = f; feats.appendChild(li); });
  const tags = $('panel-tags'); tags.innerHTML = '';
  p.stack.forEach((t) => { const li = document.createElement('li'); li.textContent = t; tags.appendChild(li); });
  $('panel-gh').href = p.url;
  const ex = $('panel-extra');
  if (p.extra) { ex.hidden = false; ex.textContent = p.extra.label; ex.href = p.extra.url; } else ex.hidden = true;
  panel.scrollTop = 0;
}
function openPanel(i) {
  fillPanel(i);
  panel.classList.add('open');
  panel.removeAttribute('inert');
  panel.setAttribute('aria-hidden', 'false');
  document.body.classList.add('panel-open');
  navBtns.forEach((b, k) => b.classList.toggle('active', k === i));
}
function closePanelUi() {
  panel.classList.remove('open');
  panel.setAttribute('inert', '');
  panel.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('panel-open');
  navBtns.forEach((b) => b.classList.remove('active'));
}
panel.setAttribute('inert', '');

/* ================= Camera flights ================= */
let flight = null;
let overviewSaved = null;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

function focusPose(i) {
  const pl = world.planets[i];
  const pw = pl.world;
  const rad = _a.copy(pw).setY(0);
  if (rad.lengthSq() < 1e-4) rad.set(0, 0, 1);
  rad.normalize();
  // camera from the side, "from the inside": we see the core-lit side of the planet with the core in the background
  const ang = Math.PI - 0.95;
  const dir = new THREE.Vector3(
    rad.x * Math.cos(ang) - rad.z * Math.sin(ang), 0,
    rad.x * Math.sin(ang) + rad.z * Math.cos(ang),
  );
  const dist = pl.radius * (mobileLayout() ? 6.4 : 5.4) + (pl.ring ? pl.radius * 1.2 : 0);
  return {
    pos: new THREE.Vector3().copy(pw).addScaledVector(dir, dist).add(_b.set(0, dist * 0.3, 0)),
    target: pw.clone(),
    dist,
  };
}

function startFlight(kind, index, onDone) {
  const instant = !animOn;
  controls.enabled = false;
  controls.autoRotate = false;
  state.mode = 'flying';
  const from = { pos: camera.position.clone(), target: controls.target.clone(), shift };
  const dur = instant ? 0 : kind === 'return' ? 1.9 : 2.3;
  flight = { t: 0, dur, kind, index, from, onDone, toShift: kind === 'planet' ? 1 : 0 };
  needsRender = true;
}

function selectPlanet(i, opts = {}) {
  if (state.mode === 'intro') finishIntro();
  if (state.mode === 'flying' && flight && flight.kind === 'planet' && flight.index === i) return;
  if (state.mode === 'focus' && state.focus === i) { panel.focus?.(); return; }
  if (state.mode === 'overview') overviewSaved = { pos: camera.position.clone(), target: controls.target.clone() };
  state.focus = i;
  openPanel(i);
  history.replaceState(null, '', `#${PROJECTS[i].id}`);
  document.body.classList.add('interacted');
  world.planets.forEach((p, k) => { p.focusTarget = k === i; });
  startFlight('planet', i, () => {
    state.mode = 'focus';
    const fp = focusPose(i);
    controls.minDistance = world.planets[i].radius * 2.4;
    controls.maxDistance = fp.dist * 2.6;
    controls.enabled = true;
    controls.autoRotate = animOn;
    controls.update();
    if (!opts.noFocus) $('panel-close').focus({ preventScroll: true });
  });
}

function closeFocus() {
  if (state.mode !== 'focus' && !(state.mode === 'flying' && flight?.kind === 'planet')) return;
  closePanelUi();
  history.replaceState(null, '', location.pathname + location.search);
  const idx = state.focus;
  state.focus = -1;
  world.planets.forEach((p) => { p.focusTarget = false; });
  startFlight('return', -1, () => {
    state.mode = 'overview';
    overviewSaved = null;
    controls.minDistance = 14;
    controls.maxDistance = 150;
    controls.enabled = true;
    controls.autoRotate = animOn;
    controls.update();
  });
  if (idx >= 0) navBtns[idx]?.focus({ preventScroll: true });
}

function stepPlanet(d) {
  const n = PROJECTS.length;
  const cur = state.focus >= 0 ? state.focus : 0;
  selectPlanet((cur + d + n) % n, { noFocus: true });
}

$('panel-close').addEventListener('click', closeFocus);
$('panel-home').addEventListener('click', closeFocus);
$('panel-prev').addEventListener('click', () => stepPlanet(-1));
$('panel-next').addEventListener('click', () => stepPlanet(1));
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (state.mode === 'intro') finishIntro();
    else closeFocus();
  } else if (state.mode === 'focus' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    stepPlanet(e.key === 'ArrowRight' ? 1 : -1);
  }
});

/* ================= Hover and click ================= */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pointer = { x: 0, y: 0, nx: 0, ny: 0, inside: false, dirty: false, down: false, sx: 0, sy: 0, st: 0, type: 'mouse' };
let hovered = -1;
const label = $('label');
const labelName = label.querySelector('.label-name');
const labelKind = label.querySelector('.label-kind');

function setHover(i, fromCanvas = true) {
  if (i === hovered) return;
  hovered = i;
  world.planets.forEach((p, k) => { p.hoverTarget = k === i ? 1 : 0; });
  if (i >= 0) {
    labelName.textContent = PROJECTS[i].name;
    labelKind.textContent = PROJECTS[i].kind;
    label.classList.add('show');
  } else label.classList.remove('show');
  if (fromCanvas) renderer.domElement.style.cursor = i >= 0 ? 'pointer' : '';
  needsRender = true;
}
function pick(clientX, clientY) {
  ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(world.hits, false);
  return hits.length ? hits[0].object.userData.index : -1;
}
const cv = renderer.domElement;
cv.addEventListener('pointermove', (e) => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  pointer.nx = (e.clientX / innerWidth) * 2 - 1;
  pointer.ny = (e.clientY / innerHeight) * 2 - 1;
  pointer.inside = true; pointer.type = e.pointerType;
  if (e.pointerType !== 'touch') pointer.dirty = true;
});
cv.addEventListener('pointerleave', () => { pointer.inside = false; if (hovered >= 0 && !pointer.down) setHover(-1); });
cv.addEventListener('pointerdown', (e) => {
  pointer.down = true; pointer.sx = e.clientX; pointer.sy = e.clientY; pointer.st = performance.now();
  if (e.pointerType !== 'touch') renderer.domElement.style.cursor = hovered >= 0 ? 'pointer' : 'grabbing';
});
cv.addEventListener('pointerup', (e) => {
  pointer.down = false;
  const moved = Math.hypot(e.clientX - pointer.sx, e.clientY - pointer.sy);
  if (moved < 9 && performance.now() - pointer.st < 600 && state.mode !== 'intro') {
    const i = pick(e.clientX, e.clientY);
    if (i >= 0) { setHover(e.pointerType === 'touch' ? -1 : i); selectPlanet(i); }
  }
  if (e.pointerType !== 'touch') renderer.domElement.style.cursor = hovered >= 0 ? 'pointer' : '';
});
cv.addEventListener('pointercancel', () => { pointer.down = false; });

const _lp = new THREE.Vector3();
function updateLabel() {
  if (hovered < 0) return;
  const pl = world.planets[hovered];
  _lp.copy(pl.world); _lp.y += pl.radius * 1.55;
  _lp.project(camera);
  let x = (_lp.x * 0.5 + 0.5) * innerWidth;
  let y = (-_lp.y * 0.5 + 0.5) * innerHeight;
  x = Math.min(innerWidth - 80, Math.max(80, x));
  y = Math.min(innerHeight - 120, Math.max(60, y));
  label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
}

/* ================= Intro ================= */
const INTRO_DUR = 6.8;
let introT = 0;
const introEl = $('intro');
const startPose = overviewPose();
function setIntroPose(u) {
  const e = 1 - Math.pow(1 - u, 3.4);
  const end = overviewPose();
  const endDist = end.pos.length();
  const dist = THREE.MathUtils.lerp(460, endDist, e);
  const az = THREE.MathUtils.lerp(1.15, 0, ease(clamp01(u * 1.05)));
  const endEl = 0.3;
  const el = THREE.MathUtils.lerp(0.02, endEl, e);
  camera.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist);
  camera.lookAt(0, 0, 0);
  const fov = 55 + (1 - e) * 22;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  // the core ignites, planets fade in
  const coreK = ease(clamp01(u / 0.45));
  world.coreGroup.scale.setScalar(0.01 + 0.99 * coreK);
  world.coreMat.uniforms.uBoost.value = 0.3 + 0.7 * coreK;
  world.glowMat.uniforms.uBoost.value = 0.2 + 0.8 * coreK;
  world.planets.forEach((p, k) => {
    const s = ease(clamp01((u - 0.38 - k * 0.08) / 0.3));
    p.orbit.scale.setScalar(Math.max(0.001, s));
    p.lineMat.visible = s > 0.02;
  });
  if (bloom) bloom.strength = 0.8 + (1 - ease(clamp01(u / 0.7))) * 1.6;
}
function resetIntroVisuals() {
  camera.fov = 55; camera.updateProjectionMatrix();
  world.coreGroup.scale.setScalar(1);
  world.coreMat.uniforms.uBoost.value = 1;
  world.glowMat.uniforms.uBoost.value = 1;
  world.planets.forEach((p) => { p.orbit.scale.setScalar(1); p.lineMat.visible = true; });
  if (bloom) bloom.strength = 0.8;
}
function finishIntro() {
  if (state.mode !== 'intro') return;
  resetIntroVisuals();
  const pose = overviewPose();
  camera.position.copy(pose.pos);
  controls.target.copy(pose.target);
  camera.lookAt(pose.target);
  state.mode = 'overview';
  controls.enabled = true;
  controls.autoRotate = animOn;
  controls.update();
  introEl.classList.add('out');
  document.body.classList.add('ui-ready');
  document.body.classList.remove('intro-running');
  needsRender = true;
  setTimeout(() => { introEl.hidden = true; }, 1400);
  setTimeout(() => $('hint').classList.add('fade'), 12000);
}
$('btn-skip').addEventListener('click', finishIntro);

/* ================= Adaptive quality ================= */
function applyLevel(name) {
  levelName = name;
  world.setLevel(name);
  const wantBloom = LEVELS[name].bloom && composer;
  document.body.dataset.quality = name;
  resize();
  needsRender = true;
  useBloom = !!wantBloom;
}
let useBloom = LEVELS[levelName].bloom && !!composer;
document.body.dataset.quality = levelName;
let govAcc = 0, govN = 0, govSkip = 60;
document.addEventListener('visibilitychange', () => { govAcc = 0; govN = 0; govSkip = 40; });

/* ================= Main loop ================= */
const clock = { last: performance.now(), sim: 0 };
const par = { x: 0, y: 0 };
let firstFrame = true;
const _fp = new THREE.Vector3();
const _prev = new THREE.Vector3();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - clock.last) / 1000);
  clock.last = now;
  const animating = animOn;
  if (animating) clock.sim += dt;

  // --- intro ---
  if (state.mode === 'intro') {
    introT += dt;
    const u = clamp01(introT / INTRO_DUR);
    setIntroPose(u);
    if (introT > 0.4) document.body.classList.add('intro-running');
    if (u >= 1) finishIntro();
    needsRender = true;
  }

  // --- camera flight ---
  if (state.mode === 'flying' && flight) {
    flight.t += dt;
    const k = flight.dur > 0 ? clamp01(flight.t / flight.dur) : 1;
    const e = ease(k);
    let to;
    if (flight.kind === 'planet') to = focusPose(flight.index);
    else to = overviewSaved || overviewPose();
    const lift = Math.sin(Math.PI * e) * (flight.kind === 'planet' ? 5 : 9);
    camera.position.lerpVectors(flight.from.pos, to.pos, e);
    camera.position.y += lift;
    controls.target.lerpVectors(flight.from.target, to.target, e);
    camera.lookAt(controls.target);
    shift = THREE.MathUtils.lerp(flight.from.shift, flight.toShift, e);
    applyShift();
    needsRender = true;
    if (k >= 1) {
      const done = flight.onDone;
      flight = null;
      shift = done && state.focus >= 0 ? 1 : 0;
      applyShift();
      done && done();
    }
  } else if (state.mode === 'focus' && state.focus >= 0) {
    // follow the moving planet
    const pl = world.planets[state.focus];
    _fp.copy(pl.world);
    _prev.copy(_fp).sub(controls.target);
    if (_prev.lengthSq() > 1e-10) { camera.position.add(_prev); controls.target.copy(_fp); needsRender = true; }
  }

  // --- smoothly slow the orbit near the selected planet ---
  for (const p of world.planets) {
    const goal = p.focusTarget ? 0.08 : 1;
    p.speedScale += (goal - p.speedScale) * Math.min(1, dt * 2.5);
  }

  // --- controls ---
  if (controls.enabled || state.mode === 'intro') {
    if (controls.enabled && controls.update(dt)) needsRender = true;
  }

  // --- mouse parallax (layers at different "depths") ---
  if (animating && pointer.type !== 'touch' && pointer.inside) {
    par.x += (pointer.nx - par.x) * Math.min(1, dt * 2.5);
    par.y += (pointer.ny - par.y) * Math.min(1, dt * 2.5);
    needsRender = true;
  } else if (animating && (Math.abs(par.x) > 0.001 || Math.abs(par.y) > 0.001)) {
    par.x *= 1 - Math.min(1, dt * 1.5); par.y *= 1 - Math.min(1, dt * 1.5);
    needsRender = true;
  }
  world.starLayer.rotation.y = par.x * 0.03;
  world.starLayer.rotation.x = par.y * 0.02;
  world.skyLayer.rotation.y = par.x * 0.012;
  world.skyLayer.rotation.x = par.y * 0.008;
  world.systemLayer.position.set(par.x * 0.7, -par.y * 0.45, 0);

  // --- reduced mode: with animations off, render only when needed ---
  if (!animating && !needsRender) return;

  // --- world ---
  world.update(animating ? dt : 0, clock.sim, animating, camera);

  // --- hover ---
  if (pointer.dirty && !pointer.down && state.mode !== 'intro' && state.mode !== 'flying') {
    pointer.dirty = false;
    setHover(pick(pointer.x, pointer.y));
  } else if (!animating) pointer.dirty = false;
  updateLabel();

  // --- render ---
  if (useBloom && composer) composer.render(dt);
  else renderer.render(scene, camera);
  needsRender = false;

  if (firstFrame) {
    firstFrame = false;
    requestAnimationFrame(() => {
      document.body.classList.remove('is-loading');
      document.body.classList.add('is-ready');
      $('loader').hidden = true;
      window.__universeReady = true;
    });
  }

  // --- FPS watchdog: lower the quality when frames get slow ---
  if (adaptive && animating && (state.mode === 'overview' || state.mode === 'focus') && !document.hidden) {
    if (govSkip > 0) { govSkip--; }
    else {
      govAcc += dt; govN++;
      if (govN >= 100) {
        const avg = govAcc / govN;
        govAcc = 0; govN = 0;
        const idx = LEVEL_ORDER.indexOf(levelName);
        if (avg > 0.036 && idx < LEVEL_ORDER.length - 1) {
          applyLevel(LEVEL_ORDER[idx + 1]);
          govSkip = 60;
          console.info('[universe] low FPS - quality:', levelName);
        }
      }
    }
  }
}

/* ================= Startup ================= */
$('panel-gh').addEventListener('click', () => {});
const wantPlanet = PROJECTS.findIndex((p) => `#${p.id}` === location.hash);
const skipIntro = !animOn || wantPlanet >= 0 || params.has('nointro');
resize();
applyLevel(levelName);
if (skipIntro) {
  finishIntro();
  introEl.hidden = true;
} else {
  setIntroPose(0);
  controls.target.set(0, 0, 0);
}
requestAnimationFrame((t) => { clock.last = t; frame(t); });
if (wantPlanet >= 0) setTimeout(() => selectPlanet(wantPlanet, { noFocus: true }), 50);

// debug hook for automated checks (exposes nothing sensitive)
window.__universe = { get level() { return levelName; }, get mode() { return state.mode; }, select: selectPlanet, close: closeFocus,
  screenOf(i) { const v = world.planets[i].world.clone().project(camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight }; } };
