import * as THREE from 'three';
import {
  starVert, starFrag, nebulaVert, nebulaFrag, auroraVert, auroraFrag,
  coreVert, coreFrag, glowVert, glowFrag, planetVert, planetFrag,
  atmoVert, atmoFrag, ringVert, ringFrag, cometVert, cometFrag,
} from './shaders.js';
import { PROJECTS } from './projects.js';

export const LEVELS = {
  high:   { dpr: 2,   bloom: true,  stars: 16000, asteroids: 2600, oct: 5, pOct: 5, comets: 3, aurora: true },
  medium: { dpr: 1.5, bloom: true,  stars: 9000,  asteroids: 1400, oct: 4, pOct: 4, comets: 2, aurora: true },
  low:    { dpr: 1,   bloom: false, stars: 4500,  asteroids: 500,  oct: 3, pOct: 3, comets: 1, aurora: false },
};
export const LEVEL_ORDER = ['high', 'medium', 'low'];

// детерминированный ГСЧ — одинаковая вселенная при каждой загрузке
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createWorld(levelName) {
  const L = LEVELS[levelName];
  const rnd = mulberry32(20261004);
  const root = new THREE.Group();

  const uTime = { value: 0 };
  const uPx = { value: 1 };
  const uLightPos = { value: new THREE.Vector3() };

  /* ---- слои параллакса ---- */
  const skyLayer = new THREE.Group();   // самый дальний
  const starLayer = new THREE.Group();
  const systemLayer = new THREE.Group();
  root.add(skyLayer, starLayer, systemLayer);

  /* ---- туманность ---- */
  const nebulaMat = new THREE.ShaderMaterial({
    vertexShader: nebulaVert, fragmentShader: nebulaFrag,
    uniforms: { uTime, uOct: { value: L.oct } },
    side: THREE.BackSide, depthWrite: false, depthTest: false,
  });
  const nebula = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 32), nebulaMat);
  nebula.renderOrder = -100;
  nebula.frustumCulled = false;
  skyLayer.add(nebula);

  /* ---- полярное сияние ---- */
  const auroraMat = new THREE.ShaderMaterial({
    vertexShader: auroraVert, fragmentShader: auroraFrag,
    uniforms: { uTime, uStrength: { value: 1.0 } },
    side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const aurora = new THREE.Mesh(new THREE.CylinderGeometry(120, 120, 46, 192, 1, true), auroraMat);
  aurora.position.y = -4;
  aurora.renderOrder = -50;
  aurora.frustumCulled = false;
  aurora.visible = L.aurora;
  starLayer.add(aurora);

  /* ---- звёзды ---- */
  const N = L.stars;
  const pos = new Float32Array(N * 3);
  const size = new Float32Array(N);
  const phase = new Float32Array(N);
  const col = new Float32Array(N * 3);
  const palette = [
    [0.75, 0.85, 1.0], [1.0, 1.0, 1.0], [1.0, 0.92, 0.8], [0.8, 0.7, 1.0], [0.6, 0.95, 1.0],
  ];
  for (let i = 0; i < N; i++) {
    const far = rnd() < 0.72;
    const r = far ? 300 + rnd() * 450 : 45 + rnd() * 160;
    const u = rnd() * 2 - 1;
    const th = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = r * s * Math.cos(th);
    pos[i * 3 + 1] = r * u;
    pos[i * 3 + 2] = r * s * Math.sin(th);
    const big = rnd();
    size[i] = (far ? 1.1 : 1.5) + (big > 0.985 ? 5 : big > 0.9 ? 2 : big * 1.0);
    phase[i] = rnd();
    const c = palette[(rnd() * palette.length) | 0];
    const b = 0.55 + rnd() * 0.45;
    col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(starGeo, new THREE.ShaderMaterial({
    vertexShader: starVert, fragmentShader: starFrag,
    uniforms: { uTime, uPx },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  stars.frustumCulled = false;
  starLayer.add(stars);

  /* ---- ядро ---- */
  const coreMat = new THREE.ShaderMaterial({
    vertexShader: coreVert, fragmentShader: coreFrag,
    uniforms: { uTime, uBoost: { value: 1 } },
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(2.1, 48, 32), coreMat);
  const glowMat = new THREE.ShaderMaterial({
    vertexShader: glowVert, fragmentShader: glowFrag,
    uniforms: { uTime, uBoost: { value: 1 } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat);
  glow.scale.setScalar(17);
  const coreGroup = new THREE.Group();
  coreGroup.add(core, glow);
  systemLayer.add(coreGroup);

  // PointLight нужен только для пояса астероидов (Lambert)
  const sun = new THREE.PointLight(0xbfd0ff, 3.2, 0, 0);
  systemLayer.add(sun);
  systemLayer.add(new THREE.AmbientLight(0x4a3f8f, 0.55));

  /* ---- планеты ---- */
  const planets = [];
  const tmpC = new THREE.Color();
  PROJECTS.forEach((p, idx) => {
    const orbit = new THREE.Group();
    orbit.rotation.x = p.orbit.incl;
    const pivot = new THREE.Group();
    pivot.rotation.y = p.orbit.phase;
    const holder = new THREE.Group();
    holder.position.x = p.orbit.radius;
    pivot.add(holder);
    orbit.add(pivot);

    const b = p.body;
    const uHover = { value: 0 };
    const mat = new THREE.ShaderMaterial({
      vertexShader: planetVert, fragmentShader: planetFrag,
      uniforms: {
        uColA: { value: new THREE.Vector3(...b.colA) },
        uColB: { value: new THREE.Vector3(...b.colB) },
        uColC: { value: new THREE.Vector3(...b.colC) },
        uAtmo: { value: new THREE.Vector3(...b.atmo) },
        uSeed: { value: b.seed }, uBands: { value: b.bands }, uBandMix: { value: b.bandMix },
        uHover, uTime, uOct: { value: L.pOct }, uLightPos,
      },
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(b.size, 64, 48), mat);
    body.rotation.z = 0.25 + idx * 0.2;
    holder.add(body);

    // атмосфера
    const scaleA = 1.28;
    const lim = Math.sqrt(1 - 1 / (scaleA * scaleA));
    const atmoMat = new THREE.ShaderMaterial({
      vertexShader: atmoVert, fragmentShader: atmoFrag,
      uniforms: {
        uColor: { value: new THREE.Vector3(...b.atmo) }, uHover, uLim: { value: lim },
        uLightDir: { value: new THREE.Vector3() },
      },
      side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(b.size * scaleA, 48, 32), atmoMat);
    holder.add(atmo);

    // кольцо
    let ring = null;
    if (b.ring) {
      const inner = b.size * 1.55, outer = b.size * 2.5;
      ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 128, 1), new THREE.ShaderMaterial({
        vertexShader: ringVert, fragmentShader: ringFrag,
        uniforms: {
          uIn: { value: inner }, uOut: { value: outer }, uHover,
          uColA: { value: new THREE.Vector3(0.45, 0.4, 1.0) }, uColB: { value: new THREE.Vector3(0.6, 0.95, 1.0) },
        },
        side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      ring.rotation.x = Math.PI / 2 - 0.42;
      ring.rotation.y = 0.2;
      holder.add(ring);
    }
    // тонкий светящийся «гало»-обруч
    if (b.halo) {
      const hr = b.size * 1.75;
      ring = new THREE.Mesh(new THREE.RingGeometry(hr, hr * 1.04, 128, 1), new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.5, 1.4, 1.6), side: THREE.DoubleSide, transparent: true, opacity: 0.75,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      ring.rotation.x = Math.PI / 2 - 0.9;
      ring.rotation.y = -0.4;
      holder.add(ring);
    }

    // спутник у первой планеты
    let moon = null;
    if (p.id === 'habit') {
      moon = new THREE.Group();
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 14), new THREE.MeshLambertMaterial({ color: 0xb9ffd9, emissive: 0x0a3a2a }));
      m.position.x = b.size * 2.3;
      moon.add(m);
      moon.rotation.x = 0.4;
      holder.add(moon);
    }

    // невидимая «зона попадания» — удобно попадать пальцем
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(b.size * 1.7, 2.1), 12, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.userData.index = idx;
    holder.add(hit);

    // линия орбиты
    const pts = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * p.orbit.radius, 0, Math.sin(a) * p.orbit.radius));
    }
    const lineMat = new THREE.LineBasicMaterial({
      color: tmpC.setRGB(b.atmo[0], b.atmo[1], b.atmo[2]).clone(), transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lineMat);
    orbit.add(line);

    systemLayer.add(orbit);
    planets.push({
      index: idx, data: p, orbit, pivot, holder, body, atmo, ring, moon, hit, mat, uHover, lineMat,
      angle: p.orbit.phase, hover: 0, hoverTarget: 0, radius: b.size,
      world: new THREE.Vector3(),
    });
  });

  /* ---- пояс астероидов ---- */
  const beltGroup = new THREE.Group();
  beltGroup.rotation.x = -0.03;
  const maxAst = L.asteroids;
  const astGeo = new THREE.IcosahedronGeometry(1, 0);
  const astMat = new THREE.MeshLambertMaterial({ flatShading: true });
  const belt = new THREE.InstancedMesh(astGeo, astMat, maxAst);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  const cc = new THREE.Color();
  for (let i = 0; i < maxAst; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 17.6 + (rnd() + rnd() + rnd()) / 3 * 3.4 - 0.2;
    ps.set(Math.cos(a) * r, (rnd() - 0.5) * 0.9 * (0.4 + rnd()), Math.sin(a) * r);
    e.set(rnd() * 6, rnd() * 6, rnd() * 6); q.setFromEuler(e);
    const s = 0.035 + Math.pow(rnd(), 4) * 0.2 + rnd() * 0.05;
    sc.set(s * (0.8 + rnd() * 0.6), s, s * (0.8 + rnd() * 0.6));
    m4.compose(ps, q, sc);
    belt.setMatrixAt(i, m4);
    const tint = rnd();
    cc.setRGB(0.5 + tint * 0.3, 0.45 + tint * 0.15, 0.55 + tint * 0.35).multiplyScalar(0.5 + rnd() * 0.5);
    belt.setColorAt(i, cc);
  }
  belt.count = maxAst;
  belt.frustumCulled = false;
  beltGroup.add(belt);
  systemLayer.add(beltGroup);

  /* ---- кометы ---- */
  const TRAIL = 42, NC = 3;
  const cPos = new Float32Array(NC * TRAIL * 3);
  const cSize = new Float32Array(NC * TRAIL);
  const cAlpha = new Float32Array(NC * TRAIL);
  const cMix = new Float32Array(NC * TRAIL);
  for (let c = 0; c < NC; c++) for (let i = 0; i < TRAIL; i++) cMix[c * TRAIL + i] = Math.min(1, i / TRAIL * 1.3);
  const cGeo = new THREE.BufferGeometry();
  cGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3).setUsage(THREE.DynamicDrawUsage));
  cGeo.setAttribute('aSize', new THREE.BufferAttribute(cSize, 1).setUsage(THREE.DynamicDrawUsage));
  cGeo.setAttribute('aAlpha', new THREE.BufferAttribute(cAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  cGeo.setAttribute('aMix', new THREE.BufferAttribute(cMix, 1));
  const cometPts = new THREE.Points(cGeo, new THREE.ShaderMaterial({
    vertexShader: cometVert, fragmentShader: cometFrag, uniforms: { uPx },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  cometPts.frustumCulled = false;
  root.add(cometPts);
  const comets = [];
  for (let c = 0; c < NC; c++) {
    comets.push({ head: new THREE.Vector3(), dir: new THREE.Vector3(), speed: 0, life: 0, wait: 1.5 + c * 3.2 + rnd() * 3, active: false });
  }
  function spawnComet(cm) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const from = new THREE.Vector3(s * Math.cos(th), u * 0.45, s * Math.sin(th)).multiplyScalar(95 + rnd() * 25);
    const aim = new THREE.Vector3((rnd() - 0.5) * 50, (rnd() - 0.5) * 16, (rnd() - 0.5) * 50);
    cm.head.copy(from);
    cm.dir.copy(aim).sub(from).normalize();
    cm.speed = 16 + rnd() * 12;
    cm.life = 0;
    cm.active = true;
    cm.total = 230 / cm.speed;
  }
  function updateComets(dt, enabled, count) {
    for (let c = 0; c < NC; c++) {
      const cm = comets[c];
      const off = c * TRAIL;
      if (!enabled || c >= count) {
        for (let i = 0; i < TRAIL; i++) cAlpha[off + i] = 0;
        cm.active = false;
        continue;
      }
      if (!cm.active) {
        cm.wait -= dt;
        for (let i = 0; i < TRAIL; i++) cAlpha[off + i] = 0;
        if (cm.wait <= 0) spawnComet(cm);
        continue;
      }
      cm.life += dt;
      cm.head.addScaledVector(cm.dir, cm.speed * dt);
      const fade = Math.min(1, cm.life / 1.0) * Math.min(1, (cm.total - cm.life) / 1.2);
      if (cm.life > cm.total) { cm.active = false; cm.wait = 4 + rnd() * 9; continue; }
      const sp = 0.85;
      for (let i = 0; i < TRAIL; i++) {
        const k = i / (TRAIL - 1);
        const j = (off + i) * 3;
        cPos[j] = cm.head.x - cm.dir.x * i * sp;
        cPos[j + 1] = cm.head.y - cm.dir.y * i * sp - k * k * 1.2;
        cPos[j + 2] = cm.head.z - cm.dir.z * i * sp;
        cSize[off + i] = i === 0 ? 9 : 6.5 * (1 - k * 0.85);
        cAlpha[off + i] = (i === 0 ? 1.0 : 0.55 * Math.pow(1 - k, 1.6)) * Math.max(0, fade);
      }
    }
    cGeo.attributes.position.needsUpdate = true;
    cGeo.attributes.aAlpha.needsUpdate = true;
    cGeo.attributes.aSize.needsUpdate = true;
  }

  /* ---- публичный API ---- */
  const _v = new THREE.Vector3();
  const _lp = new THREE.Vector3();

  function setLevel(name) {
    const lv = LEVELS[name];
    stars.geometry.setDrawRange(0, Math.min(lv.stars, N));
    belt.count = Math.min(lv.asteroids, maxAst);
    nebulaMat.uniforms.uOct.value = lv.oct;
    planets.forEach((p) => { p.mat.uniforms.uOct.value = lv.pOct; });
    aurora.visible = lv.aurora;
    api.level = lv;
    api.levelName = name;
  }

  function update(dt, time, animate, camera) {
    // дальний слой синхронизируем с камерой, чтобы небо «не приближалось»
    skyLayer.position.copy(camera.position);
    if (animate) uTime.value = time;
    if (animate) {
      for (const p of planets) {
        p.angle += p.data.orbit.speed * dt * p.speedScale;
        p.pivot.rotation.y = p.angle;
        p.body.rotation.y += p.data.body.spin * dt;
        if (p.moon) p.moon.rotation.y += dt * 0.9;
      }
      beltGroup.rotation.y += dt * 0.012;
      core.rotation.y += dt * 0.05;
    }
    coreGroup.getWorldPosition(_lp);
    uLightPos.value.copy(_lp);
    glow.quaternion.copy(camera.quaternion);
    for (const p of planets) {
      p.hover += (p.hoverTarget - p.hover) * Math.min(1, dt * 9);
      p.uHover.value = p.hover;
      p.lineMat.opacity = 0.14 + p.hover * 0.45;
      const s = 1 + p.hover * 0.07;
      p.body.scale.setScalar(s);
      p.holder.getWorldPosition(p.world);
      p.atmo.material.uniforms.uLightDir.value.copy(_v.copy(_lp).sub(p.world));
    }
    updateComets(animate ? dt : 0, animate, api.level.comets);
  }

  const api = {
    root, planets, hits: planets.map((p) => p.hit), update, setLevel, uTime, uPx,
    coreMat, glowMat, coreGroup, skyLayer, starLayer, systemLayer, level: L, levelName,
  };
  planets.forEach((p) => { p.speedScale = 1; });
  setLevel(levelName);
  return api;
}
