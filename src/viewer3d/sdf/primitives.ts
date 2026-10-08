/**
 * Signed-distance primitives used to sculpt the character procedurally.
 * Pure math (no three.js) so it runs fast inside a Web Worker and in unit tests.
 */

export type Vec3 = [number, number, number];
/** Row-major 3x3 rotation, maps local -> world. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

export type Region = 'skin' | 'shorts' | 'shoe' | 'sole' | 'lip' | 'nail' | 'hair';

interface PrimBase {
  /** Index of the owning bone (skin weights). -1 = no skinning influence (e.g. subtractive). */
  bone: number;
  /** Muscle index (shared/catalog/muscles) or -1. */
  muscle: number;
  region: Region;
  /** Smooth-union radius (m). */
  k: number;
  op: 'add' | 'sub' | 'intersect' | 'relief';
  /** Bounding sphere for culling. */
  bc: Vec3;
  br: number;
}

export interface Ellipsoid extends PrimBase {
  type: 'ellipsoid';
  c: Vec3;
  r: Vec3;
  /** local->world rotation */
  rot: Mat3;
}

export interface RoundCone extends PrimBase {
  type: 'roundCone';
  a: Vec3;
  b: Vec3;
  ra: number;
  rb: number;
  // precomputed
  ba: Vec3;
  l2: number;
  rr: number;
  a2: number;
  il2: number;
}

export interface RoundBox extends PrimBase {
  type: 'roundBox';
  c: Vec3;
  half: Vec3;
  round: number;
  rot: Mat3;
}

/** Half-space: negative on the side opposite to the normal. Only meaningful with op 'intersect'. */
export interface Plane extends PrimBase {
  type: 'plane';
  n: Vec3;
  d: number;
}

/** One cross-section station of a loft (all lengths in metres). */
export interface LoftStation {
  /** Position along the axis, 0..1. */
  t: number;
  /** Lateral half-width. */
  rx: number;
  /** Forward (front) and backward half-depths. */
  rf: number;
  rb: number;
  /** Lateral / forward centre offsets. */
  ox?: number;
  oz?: number;
  /** Front taper: lateral width shrinks toward the front (0..0.6), e.g. jaw, rib cage. */
  taper?: number;
}

/**
 * Lofted volume: superellipse cross-sections interpolated (Catmull-Rom) along a straight axis.
 * Lets anatomical silhouettes be specified directly as width/depth tables.
 */
export interface Loft extends PrimBase {
  type: 'loft';
  a: Vec3;
  u: Vec3;
  lat: Vec3;
  fwd: Vec3;
  length: number;
  n: number;
  stations: Required<LoftStation>[];
  /** Precomputed samples (LOFT_SAMPLES+1 per channel) for fast lookup. */
  table: Float32Array;
}

const LOFT_SAMPLES = 96;

/**
 * Relief: smooth groove (amp > 0) or ridge (amp < 0) added to the final field around a segment.
 * Used for muscle definition on a continuous surface (tendinous lines, borders) instead of separate blobs.
 */
export interface Relief extends PrimBase {
  type: 'relief';
  a: Vec3;
  b: Vec3;
  amp: number;
  sigma: number;
}

export type Prim = Ellipsoid | RoundCone | RoundBox | Plane | Loft | Relief;

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export interface PrimOpts {
  bone: number;
  muscle?: number;
  region?: Region;
  k?: number;
  op?: 'add' | 'sub' | 'intersect' | 'relief';
}

function base(o: PrimOpts, bc: Vec3, br: number): PrimBase {
  return {
    bone: o.bone,
    muscle: o.muscle ?? -1,
    region: o.region ?? 'skin',
    k: o.k ?? 0.02,
    op: o.op ?? 'add',
    bc,
    br,
  };
}

/** Build a rotation whose local X,Y,Z axes are the given world vectors (must be orthonormal). */
export function basis(x: Vec3, y: Vec3, z: Vec3): Mat3 {
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}

/** Rotation with local Y axis along `dir` and local Z as close as possible to `zHint`. */
export function frameY(dir: Vec3, zHint: Vec3): Mat3 {
  const y = norm(dir);
  let x = cross(y, zHint);
  if (len(x) < 1e-6) x = cross(y, [1, 0, 0]);
  x = norm(x);
  const z = cross(x, y);
  return basis(x, y, z);
}

export function ellipsoid(c: Vec3, r: Vec3, o: PrimOpts, rot: Mat3 = IDENTITY): Ellipsoid {
  return { type: 'ellipsoid', c, r, rot, ...base(o, c, Math.max(r[0], r[1], r[2])) };
}

export function roundCone(a: Vec3, b: Vec3, ra: number, rb: number, o: PrimOpts): RoundCone {
  const ba = sub(b, a);
  const l2 = dot(ba, ba);
  const rr = ra - rb;
  const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  return {
    type: 'roundCone',
    a,
    b,
    ra,
    rb,
    ba,
    l2,
    rr,
    a2: l2 - rr * rr,
    il2: 1 / l2,
    ...base(o, mid, Math.sqrt(l2) / 2 + Math.max(ra, rb)),
  };
}

/** Keep the side of the plane through `point` opposite to `normal`. Infinite bound (never culled). */
export function clipPlane(point: Vec3, normal: Vec3, o: PrimOpts): Plane {
  const n = norm(normal);
  return { type: 'plane', n, d: -dot(n, point), ...base({ ...o, op: 'intersect' }, [0, 0, 0], 1e6) };
}

export function loft(a: Vec3, b: Vec3, fwdHint: Vec3, latHint: Vec3, stations: LoftStation[], o: PrimOpts, n = 2.2): Loft {
  const ax = sub(b, a);
  const length = len(ax);
  const u = norm(ax);
  const fwd = norm(sub(fwdHint, scale(u, dot(fwdHint, u))));
  let lat = norm(cross(fwd, u));
  if (dot(lat, latHint) < 0) lat = scale(lat, -1);
  const st = stations
    .map((s) => ({ ox: 0, oz: 0, taper: 0, ...s }))
    .sort((p, q) => p.t - q.t);
  let rmax = 0;
  for (const s of st) rmax = Math.max(rmax, s.rx + Math.abs(s.ox), s.rf + Math.abs(s.oz), s.rb + Math.abs(s.oz));
  const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const table = new Float32Array((LOFT_SAMPLES + 1) * 6);
  for (let i = 0; i <= LOFT_SAMPLES; i++) {
    const smp = sampleStation(st, i / LOFT_SAMPLES);
    table.set([smp.rx, smp.rf, smp.rb, smp.ox, smp.oz, smp.taper], i * 6);
  }
  return { type: 'loft', a, u, lat, fwd, length, n, stations: st, table, ...base(o, mid, length / 2 + rmax) };
}

export function relief(a: Vec3, b: Vec3, amp: number, sigma: number): Relief {
  const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  return { type: 'relief', a, b, amp, sigma, ...base({ bone: -1, op: 'relief', k: 0 }, mid, len(sub(b, a)) / 2 + 3 * sigma) };
}

export function sphere(c: Vec3, r: number, o: PrimOpts): Ellipsoid {
  return ellipsoid(c, [r, r, r], o);
}

export function roundBox(c: Vec3, half: Vec3, round: number, o: PrimOpts, rot: Mat3 = IDENTITY): RoundBox {
  return { type: 'roundBox', c, half, round, rot, ...base(o, c, Math.hypot(half[0], half[1], half[2])) };
}

// ---- vector helpers -------------------------------------------------------

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}
export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
export function len(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}
export function norm(a: Vec3): Vec3 {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
/** a + d * t */
export function along(a: Vec3, d: Vec3, t: number): Vec3 {
  return [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t];
}
export function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// ---- distance functions ---------------------------------------------------

export function primDistance(p: Prim, x: number, y: number, z: number): number {
  switch (p.type) {
    case 'ellipsoid': {
      const dx = x - p.c[0];
      const dy = y - p.c[1];
      const dz = z - p.c[2];
      const m = p.rot;
      // world -> local = R^T * d
      const lx = (m[0] * dx + m[3] * dy + m[6] * dz) / p.r[0];
      const ly = (m[1] * dx + m[4] * dy + m[7] * dz) / p.r[1];
      const lz = (m[2] * dx + m[5] * dy + m[8] * dz) / p.r[2];
      const k0 = Math.sqrt(lx * lx + ly * ly + lz * lz);
      const k1 = Math.sqrt((lx * lx) / (p.r[0] * p.r[0]) + (ly * ly) / (p.r[1] * p.r[1]) + (lz * lz) / (p.r[2] * p.r[2]));
      if (k1 < 1e-9) return -Math.min(p.r[0], p.r[1], p.r[2]);
      return (k0 * (k0 - 1)) / k1;
    }
    case 'roundCone': {
      // Inigo Quilez, exact round cone (MIT-licensed formula, re-implemented)
      const pax = x - p.a[0];
      const pay = y - p.a[1];
      const paz = z - p.a[2];
      const ba = p.ba;
      const l2 = p.l2;
      const yy = pax * ba[0] + pay * ba[1] + paz * ba[2];
      const zz = yy - l2;
      const qx = pax * l2 - ba[0] * yy;
      const qy = pay * l2 - ba[1] * yy;
      const qz = paz * l2 - ba[2] * yy;
      const x2 = qx * qx + qy * qy + qz * qz;
      const y2 = yy * yy * l2;
      const z2 = zz * zz * l2;
      const k = Math.sign(p.rr) * p.rr * p.rr * x2;
      if (Math.sign(zz) * p.a2 * z2 > k) return Math.sqrt(x2 + z2) * p.il2 - p.rb;
      if (Math.sign(yy) * p.a2 * y2 < k) return Math.sqrt(x2 + y2) * p.il2 - p.ra;
      return (Math.sqrt(x2 * p.a2 * p.il2) + yy * p.rr) * p.il2 - p.ra;
    }
    case 'plane':
      return p.n[0] * x + p.n[1] * y + p.n[2] * z + p.d;
    case 'loft':
      return loftDistance(p, x, y, z);
    case 'relief': {
      const t = segT(p.a, p.b, x, y, z);
      const qx = p.a[0] + (p.b[0] - p.a[0]) * t - x;
      const qy = p.a[1] + (p.b[1] - p.a[1]) * t - y;
      const qz = p.a[2] + (p.b[2] - p.a[2]) * t - z;
      return p.amp * Math.exp(-(qx * qx + qy * qy + qz * qz) / (p.sigma * p.sigma));
    }
    case 'roundBox': {
      const dx = x - p.c[0];
      const dy = y - p.c[1];
      const dz = z - p.c[2];
      const m = p.rot;
      const lx = Math.abs(m[0] * dx + m[3] * dy + m[6] * dz) - p.half[0] + p.round;
      const ly = Math.abs(m[1] * dx + m[4] * dy + m[7] * dz) - p.half[1] + p.round;
      const lz = Math.abs(m[2] * dx + m[5] * dy + m[8] * dz) - p.half[2] + p.round;
      const ox = Math.max(lx, 0);
      const oy = Math.max(ly, 0);
      const oz = Math.max(lz, 0);
      return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(lx, ly, lz), 0) - p.round;
    }
  }
}

function segT(a: Vec3, b: Vec3, x: number, y: number, z: number): number {
  const bx = b[0] - a[0];
  const by = b[1] - a[1];
  const bz = b[2] - a[2];
  const l2 = bx * bx + by * by + bz * bz;
  if (l2 < 1e-12) return 0;
  return Math.min(1, Math.max(0, ((x - a[0]) * bx + (y - a[1]) * by + (z - a[2]) * bz) / l2));
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

const STATION_KEYS = ['rx', 'rf', 'rb', 'ox', 'oz', 'taper'] as const;
type StationKey = (typeof STATION_KEYS)[number];

/** Sample the interpolated station at t (clamped). */
export function sampleStation(st: Required<LoftStation>[], t: number): Record<StationKey, number> {
  const n = st.length;
  const out = { rx: 0, rf: 0, rb: 0, ox: 0, oz: 0, taper: 0 };
  if (n === 1 || t <= st[0]!.t) {
    for (const k of STATION_KEYS) out[k] = st[0]![k];
    return out;
  }
  if (t >= st[n - 1]!.t) {
    for (const k of STATION_KEYS) out[k] = st[n - 1]![k];
    return out;
  }
  let i = 0;
  while (i < n - 2 && t > st[i + 1]!.t) i++;
  const s0 = st[Math.max(0, i - 1)]!;
  const s1 = st[i]!;
  const s2 = st[i + 1]!;
  const s3 = st[Math.min(n - 1, i + 2)]!;
  const f = (t - s1.t) / (s2.t - s1.t);
  for (const k of STATION_KEYS) out[k] = Math.max(k === 'ox' || k === 'oz' ? -1 : 0, catmull(s0[k], s1[k], s2[k], s3[k], f));
  return out;
}

function superRadius(cx: number, cz: number, rx: number, rz: number, n: number): number {
  if (n === 2) {
    const a = (cx * cx) / (rx * rx) + (cz * cz) / (rz * rz);
    return a > 0 ? 1 / Math.sqrt(a) : Math.min(rx, rz);
  }
  const a = Math.pow(Math.abs(cx) / rx, n) + Math.pow(Math.abs(cz) / rz, n);
  return a > 0 ? Math.pow(a, -1 / n) : Math.min(rx, rz);
}

const SEC = { rx: 0, rf: 0, rb: 0, ox: 0, oz: 0, taper: 0 };

function lookup(p: Loft, t: number, out: typeof SEC): typeof SEC {
  const f = Math.min(1, Math.max(0, t)) * LOFT_SAMPLES;
  const i = Math.min(LOFT_SAMPLES - 1, Math.floor(f));
  const w = f - i;
  const T = p.table;
  const a = i * 6;
  const b = a + 6;
  out.rx = T[a]! + (T[b]! - T[a]!) * w;
  out.rf = T[a + 1]! + (T[b + 1]! - T[a + 1]!) * w;
  out.rb = T[a + 2]! + (T[b + 2]! - T[a + 2]!) * w;
  out.ox = T[a + 3]! + (T[b + 3]! - T[a + 3]!) * w;
  out.oz = T[a + 4]! + (T[b + 4]! - T[a + 4]!) * w;
  out.taper = T[a + 5]! + (T[b + 5]! - T[a + 5]!) * w;
  return out;
}

function sectionRadius(s: typeof SEC, cx: number, cz: number, n: number): number {
  const rz = cz >= 0 ? s.rf : s.rb;
  let r = superRadius(cx, cz, s.rx, rz, n);
  if (s.taper > 0 && cz > 0) {
    const zf = Math.min(1, (cz * r) / s.rf);
    r = superRadius(cx, cz, s.rx * (1 - s.taper * zf * zf), rz, n);
  }
  return r;
}

/** Point on a loft surface at axis parameter t and section angle (0 = +lat, PI/2 = +fwd), pushed `inset` inward. */
export function loftSurfacePoint(p: Loft, t: number, angle: number, inset = 0): Vec3 {
  const s = lookup(p, t, { ...SEC });
  const cx = Math.cos(angle);
  const cz = Math.sin(angle);
  const r = sectionRadius(s, cx, cz, p.n) - inset;
  const lx = s.ox + cx * r;
  const lz = s.oz + cz * r;
  const d = t * p.length;
  return [
    p.a[0] + p.u[0] * d + p.lat[0] * lx + p.fwd[0] * lz,
    p.a[1] + p.u[1] * d + p.lat[1] * lx + p.fwd[1] * lz,
    p.a[2] + p.u[2] * d + p.lat[2] * lx + p.fwd[2] * lz,
  ];
}

const S0 = { ...SEC };
const S1 = { ...SEC };
const S2 = { ...SEC };

function loftDistance(p: Loft, x: number, y: number, z: number): number {
  const vx = x - p.a[0];
  const vy = y - p.a[1];
  const vz = z - p.a[2];
  const along = vx * p.u[0] + vy * p.u[1] + vz * p.u[2];
  const t = along / p.length;
  const tc = Math.min(1, Math.max(0, t));
  const s = lookup(p, tc, S0);
  const lx = vx * p.lat[0] + vy * p.lat[1] + vz * p.lat[2] - s.ox;
  const lz = vx * p.fwd[0] + vy * p.fwd[1] + vz * p.fwd[2] - s.oz;
  const rho = Math.hypot(lx, lz);
  let radial: number;
  if (rho < 1e-9) radial = -Math.min(s.rx, s.rf, s.rb);
  else {
    const cx = lx / rho;
    const cz = lz / rho;
    const r = sectionRadius(s, cx, cz, p.n);
    const dt = 0.012;
    const ta = Math.min(1, tc + dt);
    const tb = Math.max(0, tc - dt);
    const g = (sectionRadius(lookup(p, ta, S1), cx, cz, p.n) - sectionRadius(lookup(p, tb, S2), cx, cz, p.n)) / ((ta - tb) * p.length);
    radial = (rho - r) / Math.sqrt(1 + g * g);
  }
  const over = t < 0 ? -t * p.length : t > 1 ? (t - 1) * p.length : 0;
  if (over <= 0) return radial;
  const rp = Math.max(radial, 0);
  return Math.sqrt(rp * rp + over * over) + Math.min(Math.max(radial, over), 0);
}

/** Polynomial smooth minimum (exact `min` when |a-b| >= k). */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** Evaluate the combined field over a candidate list (indices into prims, in definition order). */
export function evalField(prims: readonly Prim[], cand: ArrayLike<number>, x: number, y: number, z: number): number {
  let d = 1e9;
  let any = false;
  let groove = 0;
  let ridge = 0;
  for (let i = 0; i < cand.length; i++) {
    const p = prims[cand[i]!]!;
    const di = primDistance(p, x, y, z);
    if (p.op === 'relief') {
      if (di > groove) groove = di;
      else if (di < ridge) ridge = di;
      continue;
    }
    if (p.op === 'add') {
      d = any ? smin(d, di, p.k) : di;
      any = true;
    } else if (!any) {
      continue;
    } else if (p.op === 'sub') {
      d = -smin(-d, di, p.k);
    } else {
      d = -smin(-d, -di, p.k);
    }
  }
  return d + groove + ridge;
}

/** Minimal distance from point to bounding sphere surface (negative inside). */
export function boundDistance(p: Prim, x: number, y: number, z: number): number {
  return Math.hypot(x - p.bc[0], y - p.bc[1], z - p.bc[2]) - p.br;
}
