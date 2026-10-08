import { muscleIndex, type MuscleId } from '@shared/catalog/muscles';
import {
  add,
  along,
  basis,
  cross,
  dot,
  ellipsoid,
  frameY,
  len,
  norm,
  roundBox,
  roundCone,
  scale,
  sphere,
  sub,
  type Mat3,
  type Prim,
  type Region,
  type Vec3,
} from '../sdf/primitives';

/**
 * Procedural anatomy of the male fitness-model character (≈1.80 m, Y-up, facing +Z,
 * character's left = +X). Everything is defined in the bind pose (relaxed A-pose):
 * a skeleton with identity bind orientations and a set of SDF "muscle bellies"
 * attached to bones. No external assets.
 */

export type Side = 'L' | 'R';
export const SIDES: readonly Side[] = ['L', 'R'];
export const sideSign = (s: Side) => (s === 'L' ? 1 : -1);

export interface BoneDef {
  name: string;
  parent: string | null;
  head: Vec3;
  /** Bind direction toward the child joint. */
  dir: Vec3;
  /** Bind reference axis perpendicular to `dir` (limbs: anterior / flexion side). */
  ref: Vec3;
  length: number;
}

export const FINGERS = ['index', 'middle', 'ring', 'pinky'] as const;
export type Finger = (typeof FINGERS)[number] | 'thumb';

/** Relaxed A-pose arm angle from vertical (radians). */
export const ARM_ANGLE = (42 * Math.PI) / 180;

export const DIM = {
  pelvis: [0, 0.97, 0] as Vec3,
  spine1: [0, 1.06, -0.005] as Vec3,
  spine2: [0, 1.19, -0.01] as Vec3,
  spine3: [0, 1.32, -0.015] as Vec3,
  neck: [0, 1.5, -0.02] as Vec3,
  head: [0, 1.6, 0] as Vec3,
  headTop: [0, 1.8, 0] as Vec3,
  clavicle: (s: number): Vec3 => [s * 0.022, 1.462, 0.022],
  shoulder: (s: number): Vec3 => [s * 0.183, 1.452, -0.012],
  upperArm: 0.3,
  forearm: 0.26,
  hip: (s: number): Vec3 => [s * 0.092, 0.93, 0.0],
  knee: (s: number): Vec3 => [s * 0.102, 0.5, 0.012],
  ankle: (s: number): Vec3 => [s * 0.112, 0.088, -0.02],
  ball: (s: number): Vec3 => [s * 0.116, 0.028, 0.125],
  toe: (s: number): Vec3 => [s * 0.12, 0.024, 0.205],
};

/** Arm frame in bind pose. */
export function armFrame(side: Side) {
  const s = sideSign(side);
  const d: Vec3 = [s * Math.sin(ARM_ANGLE), -Math.cos(ARM_ANGLE), 0];
  const out: Vec3 = [s * Math.cos(ARM_ANGLE), Math.sin(ARM_ANGLE), 0];
  const fwd: Vec3 = [0, 0, 1];
  const S = DIM.shoulder(s);
  const E = along(S, d, DIM.upperArm);
  const W = along(E, d, DIM.forearm);
  return { s, d, out, fwd, S, E, W };
}

/** Hand frame in bind pose: u = toward fingers, p = palm normal, w = thumb side. */
export function handFrame(side: Side) {
  const { s, d, W } = armFrame(side);
  const u = d;
  const p: Vec3 = [-s * Math.cos(ARM_ANGLE), -Math.sin(ARM_ANGLE), 0];
  const w: Vec3 = [0, 0, 1];
  const at = (cu: number, cp: number, cw: number): Vec3 => [
    W[0] + u[0] * cu + p[0] * cp + w[0] * cw,
    W[1] + u[1] * cu + p[1] * cp + w[1] * cw,
    W[2] + u[2] * cu + p[2] * cp + w[2] * cw,
  ];
  const vec = (cu: number, cp: number, cw: number): Vec3 =>
    norm([u[0] * cu + p[0] * cp + w[0] * cw, u[1] * cu + p[1] * cp + w[1] * cw, u[2] * cu + p[2] * cp + w[2] * cw]);
  return { s, u, p, w, W, at, vec };
}

interface FingerSpec {
  base: [number, number, number]; // (u, p, w) of the first joint
  dir: [number, number, number]; // (u, p, w) direction
  lengths: [number, number, number];
  radius: number;
}

export const FINGER_SPECS: Record<Finger, FingerSpec> = {
  index: { base: [0.094, 0, 0.026], dir: [1, 0, 0.08], lengths: [0.042, 0.025, 0.021], radius: 0.0088 },
  middle: { base: [0.097, 0, 0.0075], dir: [1, 0, 0.0], lengths: [0.046, 0.029, 0.022], radius: 0.0092 },
  ring: { base: [0.093, 0, -0.011], dir: [1, 0, -0.07], lengths: [0.043, 0.027, 0.021], radius: 0.0086 },
  pinky: { base: [0.085, 0, -0.028], dir: [1, 0, -0.16], lengths: [0.034, 0.021, 0.019], radius: 0.0076 },
  thumb: { base: [0.026, 0.01, 0.022], dir: [0.62, 0.32, 0.72], lengths: [0.044, 0.032, 0.027], radius: 0.0112 },
};

/** Geometry of a finger chain in bind pose: joints[0..3]. */
export function fingerChain(side: Side, f: Finger) {
  const hf = handFrame(side);
  const spec = FINGER_SPECS[f];
  const dir = hf.vec(spec.dir[0], spec.dir[1], spec.dir[2]);
  const joints: Vec3[] = [hf.at(spec.base[0], spec.base[1], spec.base[2])];
  for (const l of spec.lengths) joints.push(along(joints[joints.length - 1]!, dir, l));
  // flexion side: toward the palm normal, orthogonalised
  const ref = norm(sub(hf.p, scale(dir, dot(hf.p, dir))));
  return { dir, joints, ref, radius: spec.radius };
}

export function legFrame(side: Side) {
  const s = sideSign(side);
  const H = DIM.hip(s);
  const K = DIM.knee(s);
  const A = DIM.ankle(s);
  const dT = norm(sub(K, H));
  const dS = norm(sub(A, K));
  const fwdOf = (d: Vec3) => norm(sub([0, 0, 1], scale(d, dot([0, 0, 1], d))));
  const latOf = (d: Vec3, f: Vec3) => {
    const c = cross(d, f);
    // ensure lateral points away from the midline
    return c[0] * s >= 0 ? norm(c) : norm(scale(c, -1));
  };
  const fT = fwdOf(dT);
  const fS = fwdOf(dS);
  return { s, H, K, A, dT, dS, fT, fS, lT: latOf(dT, fT), lS: latOf(dS, fS) };
}

// ---------------------------------------------------------------------------
// Skeleton

export function buildBones(): BoneDef[] {
  const bones: BoneDef[] = [];
  const addBone = (name: string, parent: string | null, head: Vec3, tail: Vec3, ref: Vec3) => {
    const v = sub(tail, head);
    const dir = norm(v);
    const r = norm(sub(ref, scale(dir, dot(ref, dir))));
    bones.push({ name, parent, head, dir, ref: r, length: len(v) });
  };
  const Z: Vec3 = [0, 0, 1];
  const Y: Vec3 = [0, 1, 0];
  addBone('pelvis', null, DIM.pelvis, DIM.spine1, Z);
  addBone('spine1', 'pelvis', DIM.spine1, DIM.spine2, Z);
  addBone('spine2', 'spine1', DIM.spine2, DIM.spine3, Z);
  addBone('spine3', 'spine2', DIM.spine3, DIM.neck, Z);
  addBone('neck', 'spine3', DIM.neck, DIM.head, Z);
  addBone('head', 'neck', DIM.head, DIM.headTop, Z);
  for (const side of SIDES) {
    const a = armFrame(side);
    addBone(`clavicle_${side}`, 'spine3', DIM.clavicle(a.s), a.S, Y);
    addBone(`upperArm_${side}`, `clavicle_${side}`, a.S, a.E, a.fwd);
    addBone(`forearm_${side}`, `upperArm_${side}`, a.E, a.W, a.fwd);
    const hf = handFrame(side);
    addBone(`hand_${side}`, `forearm_${side}`, a.W, hf.at(0.095, 0, 0), hf.p);
    for (const f of [...FINGERS, 'thumb'] as Finger[]) {
      const c = fingerChain(side, f);
      for (let i = 0; i < 3; i++) {
        addBone(`${f}${i + 1}_${side}`, i === 0 ? `hand_${side}` : `${f}${i}_${side}`, c.joints[i]!, c.joints[i + 1]!, c.ref);
      }
    }
    const l = legFrame(side);
    addBone(`thigh_${side}`, 'pelvis', l.H, l.K, l.fT);
    addBone(`shin_${side}`, `thigh_${side}`, l.K, l.A, l.fS);
    addBone(`foot_${side}`, `shin_${side}`, l.A, DIM.ball(l.s), Y);
    addBone(`toes_${side}`, `foot_${side}`, DIM.ball(l.s), DIM.toe(l.s), Y);
  }
  return bones;
}

export const BONES: readonly BoneDef[] = buildBones();
export const BONE_INDEX: ReadonlyMap<string, number> = new Map(BONES.map((b, i) => [b.name, i]));

export function boneIndex(name: string): number {
  const i = BONE_INDEX.get(name);
  if (i === undefined) throw new Error(`Unknown bone ${name}`);
  return i;
}

// ---------------------------------------------------------------------------
// Primitive helpers

const m = (id: MuscleId) => muscleIndex(id);

interface Opt {
  bone: string;
  muscle?: MuscleId;
  region?: Region;
  k?: number;
  op?: 'add' | 'sub';
}
const o = (opt: Opt) => ({
  bone: opt.op === 'sub' ? -1 : boneIndex(opt.bone),
  muscle: opt.muscle ? m(opt.muscle) : -1,
  region: opt.region ?? 'skin',
  k: opt.k ?? 0.02,
  op: opt.op ?? 'add',
});

/** Rotation about Z (frontal plane tilt). */
function rotZ(a: number): Mat3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
function rotX(a: number): Mat3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}

/** A point in a limb frame: origin + d*t + lat*l + fwd*f. */
function lp(origin: Vec3, d: Vec3, lat: Vec3, fwd: Vec3, t: number, l: number, f: number): Vec3 {
  return add(add(along(origin, d, t), scale(lat, l)), scale(fwd, f));
}

// ---------------------------------------------------------------------------
// Body (torso, limbs to the wrists, shoes). Hands and head are separate finer meshes.

export function bodyPrims(): Prim[] {
  const P: Prim[] = [];
  // --- torso core masses
  P.push(ellipsoid([0, 0.962, -0.01], [0.152, 0.1, 0.104], o({ bone: 'pelvis', k: 0.05 })));
  P.push(ellipsoid([0, 1.105, -0.002], [0.124, 0.12, 0.097], o({ bone: 'spine1', k: 0.05 })));
  P.push(ellipsoid([0, 1.285, -0.008], [0.143, 0.165, 0.104], o({ bone: 'spine2', k: 0.045 })));
  P.push(ellipsoid([0, 1.39, -0.022], [0.15, 0.085, 0.095], o({ bone: 'spine3', k: 0.04 })));
  P.push(roundCone([0, 1.43, -0.018], [0, 1.57, -0.002], 0.063, 0.056, o({ bone: 'neck', k: 0.035 })));

  for (const side of SIDES) {
    const s = sideSign(side);
    // chest
    P.push(ellipsoid([s * 0.071, 1.352, 0.074], [0.083, 0.063, 0.043], o({ bone: 'spine3', muscle: 'chest', k: 0.022 }), rotZ(-s * 0.2)));
    P.push(ellipsoid([s * 0.138, 1.398, 0.05], [0.052, 0.03, 0.032], o({ bone: 'spine3', muscle: 'chest', k: 0.02 }), rotZ(-s * 0.45)));
    // serratus (no tracked muscle)
    for (const y of [1.3, 1.255, 1.21]) {
      P.push(ellipsoid([s * 0.118, y, 0.045 - (1.3 - y) * 0.2], [0.018, 0.02, 0.022], o({ bone: 'spine2', k: 0.015 })));
    }
    // abs (six-pack)
    const rows: [number, string][] = [
      [1.252, 'spine2'],
      [1.19, 'spine2'],
      [1.126, 'spine1'],
    ];
    for (const [y, bone] of rows) {
      P.push(ellipsoid([s * 0.032, y, 0.088], [0.029, 0.028, 0.018], o({ bone, muscle: 'abs', k: 0.011 })));
    }
    // obliques
    P.push(ellipsoid([s * 0.108, 1.085, 0.03], [0.04, 0.078, 0.058], o({ bone: 'spine1', muscle: 'obliques', k: 0.025 }), rotZ(s * 0.12)));
    // lats
    P.push(ellipsoid([s * 0.117, 1.27, -0.047], [0.056, 0.145, 0.055], o({ bone: 'spine2', muscle: 'lats', k: 0.03 }), rotZ(-s * 0.26)));
    // upper back (infraspinatus / teres region)
    P.push(ellipsoid([s * 0.095, 1.35, -0.088], [0.052, 0.058, 0.03], o({ bone: 'spine3', muscle: 'upper_back', k: 0.02 })));
    // upper traps
    P.push(roundCone([s * 0.034, 1.53, -0.035], [s * 0.152, 1.462, -0.022], 0.044, 0.026, o({ bone: 'spine3', muscle: 'upper_traps', k: 0.025 })));
    // erectors
    P.push(roundCone([s * 0.032, 1.02, -0.072], [s * 0.032, 1.25, -0.082], 0.03, 0.024, o({ bone: 'spine1', muscle: 'lower_back', k: 0.02 })));
    // glutes
    P.push(ellipsoid([s * 0.072, 0.915, -0.068], [0.085, 0.095, 0.074], o({ bone: 'pelvis', muscle: 'glutes', k: 0.025 })));
    P.push(ellipsoid([s * 0.124, 0.985, -0.034], [0.046, 0.055, 0.05], o({ bone: 'pelvis', muscle: 'glute_med', k: 0.022 })));
    // sternocleidomastoid
    P.push(roundCone([s * 0.038, 1.585, 0.012], [s * 0.016, 1.47, 0.042], 0.015, 0.013, o({ bone: 'neck', k: 0.015 })));
    // clavicle ridge
    P.push(roundCone([s * 0.02, 1.456, 0.046], [s * 0.155, 1.468, 0.02], 0.012, 0.011, o({ bone: `clavicle_${side}`, k: 0.02 })));
  }
  // mid traps / rhomboids
  P.push(ellipsoid([0, 1.37, -0.098], [0.1, 0.085, 0.034], o({ bone: 'spine3', muscle: 'upper_back', k: 0.025 })));
  // lower abs
  P.push(ellipsoid([0, 1.045, 0.083], [0.055, 0.055, 0.02], o({ bone: 'spine1', muscle: 'abs', k: 0.015 })));

  // --- arms (to the wrist)
  for (const side of SIDES) {
    const a = armFrame(side);
    const ub = `upperArm_${side}`;
    const fb = `forearm_${side}`;
    const at = (t: number, l: number, f: number) => lp(a.S, a.d, a.out, a.fwd, t, l, f);
    const R = frameY(a.d, a.fwd);
    P.push(sphere(a.S, 0.05, o({ bone: ub, k: 0.03 })));
    P.push(ellipsoid(at(0.045, 0.03, 0.0), [0.046, 0.088, 0.05], o({ bone: ub, muscle: 'side_delts', k: 0.02 }), R));
    P.push(ellipsoid(at(0.05, 0.004, 0.036), [0.038, 0.082, 0.035], o({ bone: ub, muscle: 'front_delts', k: 0.02 }), R));
    P.push(ellipsoid(at(0.05, 0.004, -0.036), [0.038, 0.078, 0.035], o({ bone: ub, muscle: 'rear_delts', k: 0.02 }), R));
    P.push(roundCone(at(0.02, 0, 0), at(0.28, 0, 0), 0.047, 0.036, o({ bone: ub, k: 0.03 })));
    P.push(ellipsoid(at(0.165, -0.002, 0.028), [0.036, 0.086, 0.034], o({ bone: ub, muscle: 'biceps', k: 0.015 }), R));
    P.push(ellipsoid(at(0.215, 0.022, 0.012), [0.02, 0.046, 0.02], o({ bone: ub, muscle: 'brachialis', k: 0.012 }), R));
    P.push(ellipsoid(at(0.14, -0.008, -0.032), [0.034, 0.1, 0.034], o({ bone: ub, muscle: 'triceps', k: 0.015 }), R));
    P.push(ellipsoid(at(0.12, 0.025, -0.02), [0.026, 0.07, 0.028], o({ bone: ub, muscle: 'triceps', k: 0.015 }), R));
    // elbow
    P.push(sphere(a.E, 0.036, o({ bone: fb, k: 0.02 })));
    P.push(sphere(along(a.E, a.fwd, -0.02), 0.02, o({ bone: fb, k: 0.015 })));
    // forearm
    const atF = (t: number, l: number, f: number) => lp(a.E, a.d, a.out, a.fwd, t, l, f);
    P.push(roundCone(a.E, along(a.W, a.d, -0.01), 0.042, 0.025, o({ bone: fb, k: 0.02 })));
    P.push(ellipsoid(atF(0.06, 0.012, 0.02), [0.03, 0.075, 0.03], o({ bone: fb, muscle: 'forearms', k: 0.015 }), R));
    P.push(ellipsoid(atF(0.075, -0.018, 0.006), [0.03, 0.075, 0.028], o({ bone: fb, muscle: 'forearms', k: 0.015 }), R));
    P.push(ellipsoid(atF(0.07, 0.02, -0.014), [0.026, 0.07, 0.026], o({ bone: fb, muscle: 'forearms', k: 0.015 }), R));
  }

  // --- legs
  for (const side of SIDES) {
    const l = legFrame(side);
    const tb = `thigh_${side}`;
    const sb = `shin_${side}`;
    const atT = (t: number, la: number, f: number) => lp(l.H, l.dT, l.lT, l.fT, t, la, f);
    const atS = (t: number, la: number, f: number) => lp(l.K, l.dS, l.lS, l.fS, t, la, f);
    const RT = frameY(l.dT, l.fT);
    const RS = frameY(l.dS, l.fS);
    P.push(roundCone(atT(0, 0, 0), atT(0.4, 0, 0), 0.083, 0.054, o({ bone: tb, k: 0.04 })));
    P.push(ellipsoid(atT(0.2, 0.0, 0.048), [0.042, 0.16, 0.04], o({ bone: tb, muscle: 'quads', k: 0.02 }), RT));
    P.push(ellipsoid(atT(0.22, 0.046, 0.014), [0.045, 0.17, 0.045], o({ bone: tb, muscle: 'quads', k: 0.02 }), RT));
    P.push(ellipsoid(atT(0.34, -0.034, 0.03), [0.041, 0.075, 0.039], o({ bone: tb, muscle: 'quads', k: 0.02 }), RT));
    P.push(ellipsoid(atT(0.13, -0.05, 0.0), [0.045, 0.13, 0.05], o({ bone: tb, muscle: 'adductors', k: 0.025 }), RT));
    P.push(ellipsoid(atT(0.22, 0.02, -0.045), [0.04, 0.16, 0.04], o({ bone: tb, muscle: 'hamstrings', k: 0.02 }), RT));
    P.push(ellipsoid(atT(0.21, -0.025, -0.042), [0.038, 0.16, 0.04], o({ bone: tb, muscle: 'hamstrings', k: 0.02 }), RT));
    // knee + patella (patella rides on the femur)
    P.push(sphere(atT(0.41, 0, 0.002), 0.047, o({ bone: tb, k: 0.025 })));
    P.push(ellipsoid(atT(0.425, 0, 0.042), [0.024, 0.028, 0.014], o({ bone: tb, k: 0.015 }), RT));
    // shin
    P.push(roundCone(atS(0.01, 0, 0), atS(0.4, 0, 0), 0.048, 0.03, o({ bone: sb, k: 0.03 })));
    P.push(ellipsoid(atS(0.12, -0.022, -0.042), [0.036, 0.1, 0.038], o({ bone: sb, muscle: 'gastrocnemius', k: 0.02 }), RS));
    P.push(ellipsoid(atS(0.1, 0.02, -0.036), [0.03, 0.085, 0.032], o({ bone: sb, muscle: 'gastrocnemius', k: 0.02 }), RS));
    P.push(ellipsoid(atS(0.23, 0, -0.024), [0.041, 0.12, 0.03], o({ bone: sb, muscle: 'soleus', k: 0.025 }), RS));
    P.push(ellipsoid(atS(0.15, 0.018, 0.022), [0.018, 0.12, 0.018], o({ bone: sb, k: 0.015 }), RS));
    P.push(sphere(l.A, 0.031, o({ bone: sb, k: 0.02 })));
    // shoe (foot + toe box) and sole
    const s = l.s;
    const fb = `foot_${side}`;
    const toes = `toes_${side}`;
    P.push(roundCone([s * 0.112, 0.1, -0.02], [s * 0.112, 0.07, -0.02], 0.043, 0.047, o({ bone: fb, region: 'shoe', k: 0.015 })));
    P.push(roundBox([s * 0.113, 0.052, 0.018], [0.045, 0.048, 0.09], 0.034, o({ bone: fb, region: 'shoe', k: 0.02 }), rotX(0.05)));
    P.push(ellipsoid([s * 0.119, 0.04, 0.158], [0.046, 0.034, 0.068], o({ bone: toes, region: 'shoe', k: 0.02 })));
    P.push(roundBox([s * 0.114, 0.013, 0.02], [0.05, 0.013, 0.11], 0.01, o({ bone: fb, region: 'sole', k: 0.006 })));
    P.push(roundBox([s * 0.12, 0.013, 0.17], [0.05, 0.013, 0.05], 0.012, o({ bone: toes, region: 'sole', k: 0.006 })));
    // shorts shells (slightly larger than the body underneath)
    P.push(roundCone(atT(-0.03, 0, 0), atT(0.17, 0.004, 0.0), 0.1, 0.09, o({ bone: tb, region: 'shorts', k: 0.012 })));
    P.push(ellipsoid([s * 0.072, 0.913, -0.07], [0.092, 0.103, 0.082], o({ bone: 'pelvis', region: 'shorts', k: 0.012 })));
  }
  P.push(ellipsoid([0, 0.955, -0.012], [0.163, 0.112, 0.114], o({ bone: 'pelvis', region: 'shorts', k: 0.012 })));
  return P;
}

// ---------------------------------------------------------------------------
// Head (finer mesh, includes the upper neck to overlap the body neck)

export const EYE_RADIUS = 0.0122;
export function eyeCenter(side: Side): Vec3 {
  return [sideSign(side) * 0.033, 1.684, 0.081];
}

export function headPrims(): Prim[] {
  const P: Prim[] = [];
  const h = (opt: Partial<Opt> = {}) => o({ bone: 'head', ...opt });
  P.push(roundCone([0, 1.505, -0.016], [0, 1.625, -0.006], 0.06, 0.057, o({ bone: 'neck', k: 0.03 })));
  P.push(sphere([0, 1.555, 0.046], 0.01, o({ bone: 'neck', k: 0.012 })));
  P.push(ellipsoid([0, 1.712, -0.01], [0.076, 0.09, 0.096], h({ k: 0.02 })));
  P.push(ellipsoid([0, 1.655, 0.03], [0.066, 0.075, 0.064], h({ k: 0.03 })));
  P.push(ellipsoid([0, 1.582, 0.077], [0.026, 0.02, 0.02], h({ k: 0.02 })));
  for (const side of SIDES) {
    const s = sideSign(side);
    P.push(roundCone([s * 0.053, 1.643, -0.008], [s * 0.024, 1.586, 0.06], 0.02, 0.018, h({ k: 0.025 })));
    P.push(ellipsoid([s * 0.048, 1.672, 0.062], [0.022, 0.016, 0.02], h({ k: 0.02 })));
    P.push(roundCone([0, 1.703, 0.09], [s * 0.05, 1.706, 0.077], 0.012, 0.011, h({ k: 0.015 })));
    P.push(sphere([s * 0.014, 1.644, 0.1], 0.0095, h({ k: 0.008 })));
    // ear + concha
    P.push(ellipsoid([s * 0.078, 1.672, -0.008], [0.011, 0.029, 0.02], h({ k: 0.008 }), rotX(-0.15)));
  }
  // nose
  P.push(roundCone([0, 1.69, 0.092], [0, 1.65, 0.112], 0.009, 0.012, h({ k: 0.012 })));
  P.push(sphere([0, 1.646, 0.111], 0.0135, h({ k: 0.01 })));
  // lips
  P.push(ellipsoid([0, 1.613, 0.094], [0.022, 0.0068, 0.0095], h({ region: 'lip', k: 0.006 })));
  P.push(ellipsoid([0, 1.6015, 0.092], [0.02, 0.0072, 0.0095], h({ region: 'lip', k: 0.006 })));
  // subtractive details
  for (const side of SIDES) {
    const s = sideSign(side);
    P.push(sphere([s * 0.033, 1.684, 0.097], 0.0165, h({ op: 'sub', k: 0.012 })));
    P.push(ellipsoid([s * 0.086, 1.672, -0.004], [0.006, 0.018, 0.011], h({ op: 'sub', k: 0.004 })));
  }
  P.push(roundCone([-0.02, 1.607, 0.104], [0.02, 1.607, 0.104], 0.0024, 0.0024, h({ op: 'sub', k: 0.003 })));
  return P;
}

/** Short buzz-cut hairline mask (bind-pose head coordinates). */
export function isHair(x: number, y: number, z: number): boolean {
  if (Math.abs(x) > 0.068 && y < 1.705 && z > -0.04) return false; // ears
  let line: number;
  if (z > 0.05) line = 1.752;
  else if (z > 0) line = 1.7 + (z / 0.05) * 0.052;
  else line = 1.7 - Math.min(1, -z / 0.09) * 0.065;
  return y > line;
}

// ---------------------------------------------------------------------------
// Hands (fine mesh)

export function handPrims(side: Side): Prim[] {
  const P: Prim[] = [];
  const hf = handFrame(side);
  const hb = `hand_${side}`;
  const R = basis(hf.u, hf.p, hf.w);
  P.push(roundCone(hf.at(-0.03, 0, 0), hf.at(0.012, 0, 0), 0.0275, 0.0265, o({ bone: `forearm_${side}`, k: 0.01 })));
  P.push(roundBox(hf.at(0.05, 0, 0), [0.046, 0.0135, 0.04], 0.012, o({ bone: hb, k: 0.012 }), R));
  P.push(ellipsoid(hf.at(0.035, 0.011, 0.025), [0.03, 0.012, 0.018], o({ bone: hb, k: 0.01 }), R));
  P.push(ellipsoid(hf.at(0.055, 0.009, -0.03), [0.034, 0.01, 0.012], o({ bone: hb, k: 0.01 }), R));
  for (const f of [...FINGERS, 'thumb'] as Finger[]) {
    const c = fingerChain(side, f);
    for (let i = 0; i < 3; i++) {
      const bone = `${f}${i + 1}_${side}`;
      const r0 = c.radius * (1 - i * 0.12);
      const r1 = c.radius * (1 - (i + 1) * 0.12);
      const a = c.joints[i]!;
      const b = i === 2 ? along(c.joints[3]!, c.dir, -r1 * 0.9) : c.joints[i + 1]!;
      P.push(roundCone(a, b, r0, r1, o({ bone, k: f === 'thumb' && i === 0 ? 0.012 : 0.004 })));
      if (i === 2) {
        // nail on the dorsal side
        const nc = add(along(c.joints[3]!, c.dir, -r1 * 1.8), scale(c.ref, -r1 * 0.72));
        P.push(ellipsoid(nc, [r1 * 0.8, r1 * 1.25, r1 * 0.3], o({ bone, region: 'nail', k: 0.002 }), frameY(c.dir, scale(c.ref, -1))));
      }
    }
  }
  return P;
}
