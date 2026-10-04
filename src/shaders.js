// GLSL-шейдеры вселенной. Все эффекты процедурные: ни одной текстуры.

export const NOISE = /* glsl */ `
float hash31(vec3 p){
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x){
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
        mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
        mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p, int oct){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 6; i++){
    if (i >= oct) break;
    s += a * vnoise(p);
    p = p * 2.03 + vec3(11.7, 3.1, 7.3);
    a *= 0.5;
  }
  return s;
}
`;

const OUT = /* glsl */ `
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;

/* ---------- Звёзды ---------- */
export const starVert = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uPx;
varying vec3 vColor;
varying float vTw;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float dist = max(-mv.z, 1.0);
  float tw = 0.72 + 0.28 * sin(uTime * (0.6 + aPhase * 1.4) + aPhase * 40.0);
  vTw = tw;
  vColor = aColor;
  gl_PointSize = clamp(aSize * uPx * clamp(70.0 / dist, 0.65, 2.6), 1.0, 40.0 * uPx);
  gl_Position = projectionMatrix * mv;
}
`;
export const starFrag = /* glsl */ `
varying vec3 vColor;
varying float vTw;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float core = smoothstep(1.0, 0.0, d);
  float a = core * core * (0.55 + 0.9 * core);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * a * vTw * 1.5, 1.0);
  ${OUT}
}
`;

/* ---------- Туманность (небесная сфера) ---------- */
export const nebulaVert = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
}
`;
export const nebulaFrag = /* glsl */ `
${NOISE}
uniform float uTime;
uniform int uOct;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float t = uTime * 0.012;
  // «галактическая плоскость» — полоса плотности
  float band = exp(-pow((d.y + 0.18 * sin(d.x * 2.6 + 0.7) + 0.05) * 2.6, 2.0));
  vec3 q = d * 2.2 + vec3(t, -t * 0.6, t * 0.4);
  float w = fbm(q * 0.8 + 3.0, uOct);
  float n1 = fbm(q + w * 1.6, uOct);
  float n2 = fbm(d * 3.4 + vec3(7.0, 2.0, 5.0) + w * 1.2 - t, uOct);
  float n3 = fbm(d * 1.5 + vec3(21.0, 9.0, 4.0) + t * 0.5, uOct);

  vec3 deep   = vec3(0.012, 0.010, 0.040);
  vec3 indigo = vec3(0.10, 0.08, 0.46);
  vec3 violet = vec3(0.46, 0.14, 0.78);
  vec3 cyan   = vec3(0.04, 0.62, 0.82);

  float dens = 0.35 + 0.9 * band;
  vec3 col = deep;
  col += indigo * smoothstep(0.30, 0.78, n1) * dens * 1.15;
  col += violet * smoothstep(0.42, 0.88, n2) * (0.25 + band) * 0.85;
  col += cyan   * smoothstep(0.50, 0.90, n3) * smoothstep(0.35, 0.8, n1) * (0.2 + band) * 0.75;
  // светлые пылевые прожилки
  col += vec3(0.8, 0.7, 1.0) * pow(smoothstep(0.6, 0.95, n2 * n1 * 1.8), 3.0) * 0.18 * band;
  // лёгкое затемнение к полюсам
  col *= 0.75 + 0.25 * (1.0 - abs(d.y));
  gl_FragColor = vec4(col * 0.42, 1.0);
  ${OUT}
}
`;

/* ---------- Полярное сияние (лента) ---------- */
export const auroraVert = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vH;
void main(){
  vUv = uv;
  vec3 p = position;
  float ang = atan(p.z, p.x);
  float w = sin(ang * 3.0 + uTime * 0.12) * 4.0 + sin(ang * 7.0 - uTime * 0.2) * 1.6;
  p.y += w + 6.0 * sin(ang * 1.0 + 1.3);
  vH = uv.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;
export const auroraFrag = /* glsl */ `
${NOISE}
uniform float uTime;
uniform float uStrength;
varying vec2 vUv;
varying float vH;
void main(){
  float x = vUv.x * 6.28318;
  float t = uTime * 0.08;
  float curtain = fbm(vec3(x * 2.0, vH * 1.2, t), 3);
  float rays = 0.55 + 0.45 * sin(x * 38.0 + curtain * 9.0 + t * 3.0);
  float edge = smoothstep(0.0, 0.18, vH) * pow(1.0 - vH, 1.7);
  float inten = edge * (0.25 + curtain * 1.1) * rays;
  vec3 low  = vec3(0.10, 0.95, 0.85);
  vec3 mid  = vec3(0.35, 0.40, 1.00);
  vec3 high = vec3(0.70, 0.25, 0.95);
  vec3 col = mix(low, mid, smoothstep(0.0, 0.45, vH));
  col = mix(col, high, smoothstep(0.35, 0.95, vH));
  float a = inten * uStrength * 0.45;
  gl_FragColor = vec4(col * a, 1.0);
  ${OUT}
}
`;

/* ---------- Ядро ---------- */
export const coreVert = /* glsl */ `
varying vec3 vObj;
varying vec3 vN;
varying vec3 vV;
void main(){
  vObj = position;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;
export const coreFrag = /* glsl */ `
${NOISE}
uniform float uTime;
uniform float uBoost;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vV;
void main(){
  vec3 N = normalize(vN);
  float fres = pow(1.0 - max(dot(N, normalize(vV)), 0.0), 2.2);
  float t = uTime * 0.25;
  float n = fbm(vObj * 1.4 + vec3(0.0, t, t * 0.5), 4);
  float n2 = fbm(vObj * 3.6 + n * 2.0 - t * 1.6, 4);
  vec3 outer = vec3(0.50, 0.22, 1.00);
  vec3 mid   = vec3(0.15, 0.80, 1.00);
  vec3 hot   = vec3(1.00, 0.97, 1.00);
  vec3 col = mix(outer, mid, smoothstep(0.30, 0.75, n2));
  col = mix(col, hot, smoothstep(0.45, 0.9, n) * (1.0 - fres * 0.8));
  col = col * 1.7 + outer * fres * 1.6;
  gl_FragColor = vec4(col * uBoost, 1.0);
  ${OUT}
}
`;

export const glowVert = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
export const glowFrag = /* glsl */ `
uniform float uTime;
uniform float uBoost;
varying vec2 vUv;
void main(){
  vec2 p = vUv - 0.5;
  float d = length(p) * 2.0;
  if (d > 1.0) discard;
  float ang = atan(p.y, p.x);
  float halo = pow(1.0 - d, 2.6);
  float inner = exp(-d * d * 9.0);
  float rays = pow(abs(sin(ang * 5.0 + uTime * 0.15)), 14.0) * pow(1.0 - d, 3.0) * 0.5
             + pow(abs(sin(ang * 9.0 - uTime * 0.1 + 1.0)), 24.0) * pow(1.0 - d, 4.0) * 0.35;
  vec3 c1 = vec3(0.35, 0.30, 1.00);
  vec3 c2 = vec3(0.20, 0.85, 1.00);
  vec3 col = mix(c1, c2, smoothstep(0.9, 0.0, d)) * (halo * 0.55 + rays) + vec3(1.0) * inner * 0.45;
  gl_FragColor = vec4(col * uBoost, 1.0);
  ${OUT}
}
`;

/* ---------- Планета ---------- */
export const planetVert = /* glsl */ `
varying vec3 vObj;
varying vec3 vNW;
varying vec3 vWP;
void main(){
  vObj = normalize(position);
  vNW = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
export const planetFrag = /* glsl */ `
${NOISE}
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColC;
uniform vec3 uAtmo;
uniform float uSeed;
uniform float uBands;
uniform float uBandMix;
uniform float uHover;
uniform float uTime;
uniform int uOct;
uniform vec3 uLightPos;
varying vec3 vObj;
varying vec3 vNW;
varying vec3 vWP;
void main(){
  vec3 p = vObj * 1.8 + uSeed;
  float warp = fbm(p * 1.3, uOct);
  float bands = sin((vObj.y + warp * 0.42) * uBands * 3.14159) * 0.5 + 0.5;
  float n = fbm(p * 2.6 + warp * 1.7, uOct);
  float f = mix(n, bands * 0.6 + n * 0.5, uBandMix);
  vec3 col = mix(uColA, uColB, smoothstep(0.25, 0.75, f));
  col = mix(col, uColC, smoothstep(0.62, 0.92, n) * 0.55);

  vec3 N = normalize(vNW);
  vec3 L = normalize(uLightPos - vWP);
  vec3 V = normalize(cameraPosition - vWP);
  float ndl = dot(N, L);
  float diff = smoothstep(-0.12, 0.85, ndl);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 lit = col * (0.05 + diff * 1.1);
  // огни на ночной стороне
  float lights = smoothstep(0.7, 0.9, fbm(p * 7.0, 3)) * (1.0 - diff);
  lit += uColC * lights * 0.9;
  // атмосферная кайма
  lit += uAtmo * fres * (0.12 + 0.95 * smoothstep(-0.35, 0.5, ndl)) * 0.75;
  // подсветка при наведении
  lit += (uAtmo * 0.28 + 0.06) * uHover * (0.35 + fres * 2.2);
  gl_FragColor = vec4(lit, 1.0);
  ${OUT}
}
`;

export const atmoVert = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying vec3 vWN;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vWN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * mv;
}
`;
export const atmoFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uHover;
uniform float uLim;
uniform vec3 uLightDir;
varying vec3 vN;
varying vec3 vV;
varying vec3 vWN;
void main(){
  float d = -dot(normalize(vN), normalize(vV));   // BackSide: от 0 на краю до -uLim у лимба планеты
  d = clamp(d / uLim, 0.0, 1.0);
  float g = pow(d, 2.2);
  float lit = 0.3 + 0.7 * smoothstep(-0.5, 0.6, dot(vWN, normalize(uLightDir)));
  float k = g * lit * (0.9 + uHover * 2.4);
  gl_FragColor = vec4(uColor * k, 1.0);
  ${OUT}
}
`;

/* ---------- Кольцо ---------- */
export const ringVert = /* glsl */ `
varying float vR;
varying vec3 vWP;
void main(){
  vR = length(position.xy);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
export const ringFrag = /* glsl */ `
${NOISE}
uniform float uIn;
uniform float uOut;
uniform vec3 uColA;
uniform vec3 uColB;
uniform float uHover;
varying float vR;
varying vec3 vWP;
void main(){
  float k = (vR - uIn) / (uOut - uIn);
  float bands = 0.5 + 0.5 * sin(k * 60.0 + vnoise(vec3(k * 18.0, 1.0, 2.0)) * 6.0);
  float n = vnoise(vec3(k * 40.0, 3.0, 5.0));
  float a = smoothstep(0.0, 0.08, k) * smoothstep(1.0, 0.85, k);
  a *= 0.25 + 0.6 * bands * (0.5 + n);
  a *= 1.0 - smoothstep(0.38, 0.46, k) * smoothstep(0.54, 0.46, k) * 0.9; // щель Кассини
  vec3 col = mix(uColA, uColB, k + n * 0.3);
  gl_FragColor = vec4(col * a * (1.0 + uHover * 1.2), a * 0.9);
  ${OUT}
}
`;

/* ---------- Кометы ---------- */
export const cometVert = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute float aMix;
uniform float uPx;
varying float vA;
varying float vMix;
void main(){
  vA = aAlpha;
  vMix = aMix;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float dist = max(-mv.z, 1.0);
  gl_PointSize = clamp(aSize * uPx * clamp(90.0 / dist, 0.5, 3.0), 1.0, 48.0 * uPx);
  gl_Position = projectionMatrix * mv;
}
`;
export const cometFrag = /* glsl */ `
varying float vA;
varying float vMix;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float a = pow(smoothstep(1.0, 0.0, d), 2.0) * vA;
  if (a < 0.004) discard;
  vec3 col = mix(vec3(0.85, 1.0, 1.0), vec3(0.45, 0.3, 1.0), vMix);
  gl_FragColor = vec4(col * a * 2.2, 1.0);
  ${OUT}
}
`;
