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
  op: 'add' | 'sub' | 'intersect';
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

export type Prim = Ellipsoid | RoundCone | RoundBox | Plane;

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export interface PrimOpts {
  bone: number;
  muscle?: number;
  region?: Region;
  k?: number;
  op?: 'add' | 'sub' | 'intersect';
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
  for (let i = 0; i < cand.length; i++) {
    const p = prims[cand[i]!]!;
    const di = primDistance(p, x, y, z);
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
  return d;
}

/** Minimal distance from point to bounding sphere surface (negative inside). */
export function boundDistance(p: Prim, x: number, y: number, z: number): number {
  return Math.hypot(x - p.bc[0], y - p.bc[1], z - p.bc[2]) - p.br;
}
