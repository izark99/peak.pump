import type { MuscleId } from '@shared/catalog/muscles';
import {
  add,
  along,
  clipPlane,
  ellipsoid,
  frameY,
  loft,
  relief,
  roundBox,
  roundCone,
  sampleStation,
  scale,
  loftSurfacePoint,
  type Loft,
  type LoftStation,
  type Mat3,
  type Prim,
  type Vec3,
} from '../sdf/primitives';
import { armFrame, boneIndex, DIM, legFrame, sideSign, SIDES, type Side } from './anatomy';

/**
 * Body v2: anatomical silhouette defined by lofted cross-section tables (width / front depth /
 * back depth along each segment), muscle definition as low-amplitude relief on that continuous
 * surface, and muscle labels kept separate from geometry (highlight only).
 */

const NOBONE = { bone: -1 };
const X: Vec3 = [1, 0, 0];
const Y: Vec3 = [0, 1, 0];
const Z: Vec3 = [0, 0, 1];

// ---------------------------------------------------------------------------
// Torso profile (absolute heights, bind pose). Values in metres.

const TORSO_Y0 = 0.8;
const TORSO_Y1 = 1.53;

type Row = [y: number, rx: number, rf: number, rb: number, oz: number, taper: number];
const TORSO_ROWS: Row[] = [
  [0.8, 0.07, 0.05, 0.055, -0.005, 0],
  [0.86, 0.134, 0.084, 0.098, -0.008, 0.1],
  [0.92, 0.158, 0.093, 0.118, -0.012, 0.12],
  [0.98, 0.156, 0.096, 0.104, -0.01, 0.12],
  [1.04, 0.142, 0.098, 0.092, -0.006, 0.12],
  [1.09, 0.135, 0.099, 0.09, -0.004, 0.1],
  [1.15, 0.139, 0.102, 0.094, -0.002, 0.08],
  [1.21, 0.151, 0.108, 0.1, 0.0, 0.06],
  [1.27, 0.163, 0.116, 0.105, 0.002, 0.04],
  [1.33, 0.17, 0.124, 0.108, 0.002, 0.02],
  [1.39, 0.171, 0.118, 0.107, -0.004, 0.02],
  [1.44, 0.158, 0.1, 0.1, -0.012, 0.04],
  [1.48, 0.118, 0.078, 0.084, -0.018, 0.04],
  [1.53, 0.07, 0.058, 0.064, -0.02, 0],
];

function torsoStations(): LoftStation[] {
  return TORSO_ROWS.map(([y, rx, rf, rb, oz, taper]) => ({ t: (y - TORSO_Y0) / (TORSO_Y1 - TORSO_Y0), rx, rf, rb, oz, taper }));
}

const TORSO_N = 2.35;

/** Point on the torso surface at height y, lateral x, front (+1) or back (-1). */
export function torsoSurface(y: number, x: number, side: 1 | -1, inset = 0): Vec3 {
  const st = torsoStations().map((s) => ({ ox: 0, oz: 0, taper: 0, ...s })) as Required<LoftStation>[];
  const s = sampleStation(st, (y - TORSO_Y0) / (TORSO_Y1 - TORSO_Y0));
  const r = side > 0 ? s.rf : s.rb;
  let rx = s.rx;
  // iterate once for the front taper
  for (let i = 0; i < 2; i++) {
    const zf = side > 0 ? Math.min(1, Math.pow(Math.max(0, 1 - Math.pow(Math.abs(x) / rx, TORSO_N)), 1 / TORSO_N)) : 0;
    rx = s.rx * (1 - s.taper * zf * zf);
  }
  const k = Math.max(0, 1 - Math.pow(Math.min(1, Math.abs(x) / rx), TORSO_N));
  const z = s.oz + side * (r * Math.pow(k, 1 / TORSO_N) - inset);
  return [x, y, z - 0.01];
}

// ---------------------------------------------------------------------------

function limb(a: Vec3, b: Vec3, fwd: Vec3, lat: Vec3, rows: [d: number, rx: number, rf: number, rb: number, ox?: number, oz?: number][], k: number, n = 2): Loft {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  return loft(
    a,
    b,
    fwd,
    lat,
    rows.map(([d, rx, rf, rb, ox = 0, oz = 0]) => ({ t: d / L, rx, rf, rb, ox, oz })),
    { ...NOBONE, k },
    n,
  );
}

export interface BodyParts {
  prims: Prim[];
  torso: Loft;
  thighs: Loft[];
}

/** Geometry of the body without hands, head, feet (those are separate meshes). */
export function buildBody(opts: { relief?: boolean } = {}): BodyParts {
  const P: Prim[] = [];
  const withRelief = opts.relief ?? true;
  const torso = loft([0, TORSO_Y0, -0.01], [0, TORSO_Y1, -0.01], Z, X, torsoStations(), { ...NOBONE, k: 0 }, TORSO_N);
  P.push(torso);
  // neck (blends into the torso top)
  P.push(
    limb([0, 1.43, -0.028], [0, 1.6, -0.004], Z, X, [
      [0, 0.07, 0.058, 0.068],
      [0.05, 0.064, 0.056, 0.062],
      [0.11, 0.06, 0.053, 0.058],
      [0.17, 0.055, 0.05, 0.054],
    ], 0.04),
  );
  const thighs: Loft[] = [];
  const limbs: { arm: Loft; fore: Loft; thigh: Loft; shin: Loft; side: Side }[] = [];
  for (const side of SIDES) {
    const s = sideSign(side);
    // shoulder girdle / upper traps: neck base to acromion
    P.push(
      limb([s * 0.03, 1.5, -0.03], [s * 0.19, 1.468, -0.016], Z, Y, [
        [0, 0.05, 0.042, 0.06],
        [0.08, 0.042, 0.046, 0.054],
        [0.165, 0.032, 0.044, 0.046],
      ], 0.045),
    );
    const a = armFrame(side);
    // upper arm incl. the deltoid cap (starts above the joint, widest a few cm below the acromion)
    const arm = limb(along(a.S, a.d, -0.05), a.E, a.fwd, a.out, [
      [0, 0.032, 0.04, 0.04, 0.01],
      [0.035, 0.056, 0.058, 0.058, 0.012],
      [0.085, 0.066, 0.063, 0.062, 0.013],
      [0.14, 0.06, 0.058, 0.058, 0.008],
      [0.19, 0.054, 0.056, 0.057, 0.002],
      [0.25, 0.051, 0.062, 0.058, 0, 0.002],
      [0.31, 0.046, 0.05, 0.05],
      [0.35, 0.041, 0.042, 0.043],
    ], 0.035);
    P.push(arm);
    // forearm: lateral axis = palm/dorsal thickness, fwd axis = radial/ulnar width
    const fore = limb(a.E, along(a.W, a.d, 0.012), a.fwd, a.out, [
      [0, 0.041, 0.042, 0.043],
      [0.045, 0.047, 0.05, 0.045, 0.002, 0.004],
      [0.09, 0.045, 0.047, 0.042, 0.001, 0.003],
      [0.17, 0.034, 0.036, 0.033],
      [0.24, 0.022, 0.028, 0.027],
      [0.272, 0.019, 0.026, 0.025],
    ], 0.008);
    P.push(fore);
    const l = legFrame(side);
    const KN: [number, number, number] = [0.053, 0.053, 0.05];
    const thigh = limb(along(l.H, l.dT, -0.06), l.K, l.fT, l.lT, [
      [0, 0.08, 0.078, 0.084, 0.008],
      [0.07, 0.09, 0.088, 0.09, 0.012],
      [0.18, 0.089, 0.09, 0.083, 0.012],
      [0.3, 0.08, 0.082, 0.072, 0.006],
      [0.4, 0.068, 0.07, 0.06, -0.006],
      [0.45, 0.06, 0.06, 0.054, -0.004],
      [0.49, ...KN],
    ], 0.045);
    P.push(thigh);
    thighs.push(thigh);
    const shin = limb(l.K, along(l.A, l.dS, 0.03), l.fS, l.lS, [
      [0, ...KN],
      [0.05, 0.05, 0.047, 0.056],
      [0.12, 0.052, 0.042, 0.07, -0.006],
      [0.2, 0.047, 0.039, 0.063, -0.006],
      [0.29, 0.036, 0.034, 0.042, -0.002],
      [0.37, 0.029, 0.03, 0.03],
      [0.445, 0.031, 0.03, 0.032],
    ], 0.01);
    P.push(shin);
    limbs.push({ arm, fore, thigh, shin, side });
  }

  if (withRelief) addRelief(P, limbs);
  return { prims: P, torso, thighs };
}

export function bodyShape(opts: { relief?: boolean } = {}): Prim[] {
  return buildBody(opts).prims;
}

function addRelief(P: Prim[], limbs: { arm: Loft; fore: Loft; thigh: Loft; shin: Loft; side: Side }[]) {
  const front = (y: number, x: number) => torsoSurface(y, x, 1);
  const back = (y: number, x: number) => torsoSurface(y, x, -1);
  const line = (pts: Vec3[], amp: number, sigma: number) => {
    for (let i = 0; i < pts.length - 1; i++) P.push(relief(pts[i]!, pts[i + 1]!, amp, sigma));
  };
  // sternum + linea alba
  line([front(1.43, 0), front(1.33, 0), front(1.27, 0)], 0.003, 0.009);
  line([front(1.255, 0), front(1.15, 0), front(1.03, 0)], 0.002, 0.0055);
  // tendinous intersections of rectus abdominis (shallow lines, not blocks)
  for (const [y, w] of [[1.245, 0.058], [1.18, 0.062], [1.112, 0.064]] as const) {
    line([front(y - 0.006, -w), front(y + 0.003, -w * 0.4), front(y + 0.004, 0), front(y + 0.003, w * 0.4), front(y - 0.006, w)], 0.0015, 0.0045);
  }
  for (const s of [-1, 1]) {
    // semilunar line (lateral border of the abs)
    line([front(1.27, s * 0.074), front(1.17, s * 0.078), front(1.06, s * 0.07), front(0.99, s * 0.05)], 0.002, 0.007);
    // pectoral mass (broad ridge) and its lower border
    P.push(relief(front(1.35, s * 0.045), front(1.36, s * 0.115), -0.009, 0.042));
    line([front(1.29, s * 0.012), front(1.278, s * 0.06), front(1.288, s * 0.11), front(1.33, s * 0.158)], 0.0055, 0.01);
    // clavicle
    line([front(1.468, s * 0.025), front(1.472, s * 0.09), front(1.462, s * 0.15)], -0.002, 0.007);
    // erector ridges + scapular mass + lat border
    line([back(1.0, s * 0.032), back(1.12, s * 0.032), back(1.24, s * 0.03)], -0.004, 0.013);
    P.push(relief(back(1.34, s * 0.055), back(1.37, s * 0.1), -0.005, 0.032));
    line([back(1.2, s * 0.12), back(1.3, s * 0.15), back(1.38, s * 0.16)], 0.002, 0.012);
    // gluteal fold
    line([back(0.862, s * 0.02), back(0.858, s * 0.08), back(0.87, s * 0.13)], 0.004, 0.009);
    // iliac / inguinal line (V-cut)
    line([front(1.03, s * 0.125), front(0.96, s * 0.09), front(0.9, s * 0.045)], 0.0028, 0.008);
  }
  // spine groove and gluteal cleft
  line([back(1.45, 0), back(1.25, 0), back(1.0, 0)], 0.004, 0.009);
  line([back(0.99, 0), back(0.9, 0), back(0.84, 0)], 0.006, 0.009);

  const H = Math.PI / 2;
  for (const { arm, fore, thigh, shin } of limbs) {
    const tA = (d: number) => d / arm.length;
    const tF = (d: number) => d / fore.length;
    const tT = (d: number) => d / thigh.length;
    const tS = (d: number) => d / shin.length;
    // deltoid insertion (V) and biceps/triceps separation on the lateral arm
    line([loftSurfacePoint(arm, tA(0.06), 0.9), loftSurfacePoint(arm, tA(0.17), 0.25)], 0.0025, 0.007);
    line([loftSurfacePoint(arm, tA(0.06), -0.9), loftSurfacePoint(arm, tA(0.17), -0.25)], 0.0025, 0.007);
    line([loftSurfacePoint(arm, tA(0.19), 0.15), loftSurfacePoint(arm, tA(0.31), 0.1)], 0.0022, 0.006);
    // brachioradialis border on the forearm
    line([loftSurfacePoint(fore, tF(0.03), 0.6), loftSurfacePoint(fore, tF(0.15), 0.9)], 0.0018, 0.006);
    // quads: vastus lateralis / rectus border, vastus medialis teardrop border, IT band
    line([loftSurfacePoint(thigh, tT(0.14), 0.95), loftSurfacePoint(thigh, tT(0.3), 0.75), loftSurfacePoint(thigh, tT(0.43), 0.95)], 0.0022, 0.008);
    line([loftSurfacePoint(thigh, tT(0.3), H + 0.6), loftSurfacePoint(thigh, tT(0.4), H + 0.4), loftSurfacePoint(thigh, tT(0.46), H + 0.2)], 0.0022, 0.008);
    line([loftSurfacePoint(thigh, tT(0.12), 0.05), loftSurfacePoint(thigh, tT(0.42), 0.0)], 0.0018, 0.01);
    // hamstring split
    line([loftSurfacePoint(thigh, tT(0.16), -H), loftSurfacePoint(thigh, tT(0.4), -H)], 0.002, 0.008);
    // patella
    P.push(relief(loftSurfacePoint(thigh, tT(0.455), H, 0.006), loftSurfacePoint(thigh, tT(0.49), H, 0.006), -0.005, 0.017));
    // calf: gastrocnemius heads + lower border, tibia crest
    line([loftSurfacePoint(shin, tS(0.06), -H), loftSurfacePoint(shin, tS(0.17), -H)], 0.0022, 0.007);
    line([loftSurfacePoint(shin, tS(0.2), -H - 0.9), loftSurfacePoint(shin, tS(0.25), -H), loftSurfacePoint(shin, tS(0.21), -H + 0.9)], 0.002, 0.009);
    line([loftSurfacePoint(shin, tS(0.08), H - 0.15), loftSurfacePoint(shin, tS(0.36), H - 0.1)], -0.0015, 0.006);
  }
}

// ---------------------------------------------------------------------------
// Skin-weight proxies: bone segments with a typical radius (distance-from-surface weighting).

export interface BoneProxy {
  bone: number;
  a: Vec3;
  b: Vec3;
  r: number;
}

export function bodyBoneProxies(): BoneProxy[] {
  const pr = (name: string, a: Vec3, b: Vec3, r: number): BoneProxy => ({ bone: boneIndex(name), a, b, r });
  const list: BoneProxy[] = [
    pr('pelvis', [0, 0.84, -0.01], [0, 1.04, -0.01], 0.14),
    pr('spine1', [0, 1.04, -0.01], [0, 1.17, -0.01], 0.13),
    pr('spine2', [0, 1.17, -0.01], [0, 1.31, -0.01], 0.15),
    pr('spine3', [0, 1.31, -0.015], [0, 1.47, -0.02], 0.15),
    pr('neck', [0, 1.47, -0.02], [0, 1.6, 0], 0.06),
    pr('head', DIM.head, DIM.headTop, 0.09),
  ];
  for (const side of SIDES) {
    const a = armFrame(side);
    const l = legFrame(side);
    list.push(
      pr(`clavicle_${side}`, DIM.clavicle(a.s), a.S, 0.045),
      pr(`upperArm_${side}`, a.S, a.E, 0.056),
      pr(`forearm_${side}`, a.E, a.W, 0.042),
      pr(`thigh_${side}`, l.H, l.K, 0.085),
      pr(`shin_${side}`, l.K, l.A, 0.05),
      pr(`foot_${side}`, l.A, DIM.ball(l.s), 0.04),
      pr(`toes_${side}`, DIM.ball(l.s), DIM.toe(l.s), 0.03),
    );
  }
  return list;
}

// ---------------------------------------------------------------------------
// Muscle labels (highlight only, never geometry)

export interface MuscleLabel {
  muscle: MuscleId;
  prim: Prim;
}

export function muscleLabels(): MuscleLabel[] {
  const L: MuscleLabel[] = [];
  const e = (muscle: MuscleId, c: Vec3, r: Vec3, rot?: Mat3) => L.push({ muscle, prim: ellipsoid(c, r, NOBONE, rot) });
  const cap = (muscle: MuscleId, a: Vec3, b: Vec3, r: number) => L.push({ muscle, prim: roundCone(a, b, r, r, NOBONE) });
  e('abs', [0, 1.15, 0.1], [0.075, 0.15, 0.045]);
  for (const side of SIDES) {
    const s = sideSign(side);
    e('chest', [s * 0.085, 1.35, 0.1], [0.085, 0.07, 0.06]);
    e('obliques', [s * 0.125, 1.1, 0.03], [0.04, 0.1, 0.075]);
    e('lats', [s * 0.13, 1.26, -0.06], [0.06, 0.14, 0.065]);
    e('upper_back', [s * 0.07, 1.37, -0.105], [0.075, 0.08, 0.045]);
    cap('upper_traps', [s * 0.035, 1.52, -0.035], [s * 0.17, 1.47, -0.02], 0.05);
    cap('lower_back', [s * 0.035, 0.99, -0.1], [s * 0.035, 1.22, -0.105], 0.04);
    e('glutes', [s * 0.075, 0.915, -0.1], [0.09, 0.09, 0.06]);
    e('glute_med', [s * 0.14, 0.99, -0.035], [0.04, 0.055, 0.055]);
    const a = armFrame(side);
    const R = frameY(a.d, a.fwd);
    const at = (t: number, lat: number, fwd: number) => add(add(along(a.S, a.d, t), scale(a.out, lat)), scale(a.fwd, fwd));
    e('front_delts', at(0.06, 0.005, 0.05), [0.045, 0.075, 0.035], R);
    e('side_delts', at(0.07, 0.055, 0), [0.04, 0.08, 0.045], R);
    e('rear_delts', at(0.06, 0.005, -0.05), [0.045, 0.075, 0.035], R);
    e('biceps', at(0.21, 0, 0.055), [0.04, 0.09, 0.03], R);
    e('brachialis', at(0.27, 0.045, 0.02), [0.03, 0.045, 0.03], R);
    e('triceps', at(0.18, 0, -0.055), [0.05, 0.13, 0.035], R);
    cap('forearms', a.E, a.W, 0.055);
    const l = legFrame(side);
    const RT = frameY(l.dT, l.fT);
    const RS = frameY(l.dS, l.fS);
    const atT = (t: number, la: number, f: number) => add(add(along(l.H, l.dT, t), scale(l.lT, la)), scale(l.fT, f));
    const atS = (t: number, la: number, f: number) => add(add(along(l.K, l.dS, t), scale(l.lS, la)), scale(l.fS, f));
    e('quads', atT(0.22, 0.015, 0.07), [0.085, 0.21, 0.05], RT);
    e('hamstrings', atT(0.22, 0, -0.07), [0.075, 0.2, 0.045], RT);
    e('adductors', atT(0.15, -0.08, 0), [0.04, 0.15, 0.065], RT);
    e('gastrocnemius', atS(0.13, 0, -0.07), [0.055, 0.1, 0.04], RS);
    e('soleus', atS(0.25, 0, -0.05), [0.05, 0.1, 0.035], RS);
  }
  return L;
}

// ---------------------------------------------------------------------------
// Clothing & shoes (separate meshes)

/** Sports shorts: smooth offset of the hip/thigh volume (no relief), clean planar waist and hems. */
export function shortsShape(): { prims: Prim[]; post: (d: number, x: number, y: number, z: number) => number } {
  const body = buildBody({ relief: false });
  const keep: Prim[] = [body.torso, ...body.thighs];
  const prims: Prim[] = [...keep, clipPlane([0, 1.035, 0], [0, 1, 0], NOBONE), clipPlane([0, 0.765, 0], [0, -1, 0], NOBONE)];
  const smooth = (e0: number, e1: number, v: number) => {
    const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  return {
    prims,
    post: (d, x, y) => {
      const loose = 0.012 * smooth(0.93, 0.78, y) * Math.min(1, Math.abs(x) / 0.07);
      return d - (0.007 + loose);
    },
  };
}

/** Low-profile training shoe: lofted upper + flat sole with rounded toe. */
export function shoePrims(side: Side): Prim[] {
  const s = sideSign(side);
  const P: Prim[] = [];
  const foot = boneIndex(`foot_${side}`);
  const toes = boneIndex(`toes_${side}`);
  const a: Vec3 = [s * 0.113, 0.05, -0.078];
  const b: Vec3 = [s * 0.121, 0.044, 0.207];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const rows: [number, number, number, number, number][] = [
    [0, 0.03, 0.03, 0.028, 0],
    [0.025, 0.04, 0.048, 0.033, 0],
    [0.07, 0.043, 0.056, 0.034, 0],
    [0.13, 0.045, 0.046, 0.035, 0],
    [0.19, 0.049, 0.034, 0.035, 0],
    [0.235, 0.048, 0.027, 0.032, 0],
    [0.27, 0.04, 0.022, 0.028, 0],
    [0.285, 0.026, 0.016, 0.022, 0],
  ];
  P.push(
    loft(a, b, Y, [s, 0, 0], rows.map(([d, rx, rf, rb, ox]) => ({ t: d / L, rx, rf, rb, ox })), { bone: foot, region: 'shoe', k: 0 }, 2.6),
  );
  P.push(roundBox([s * 0.115, 0.014, 0.012], [0.047, 0.014, 0.1], 0.012, { bone: foot, region: 'sole', k: 0.006 }));
  P.push(roundBox([s * 0.12, 0.014, 0.162], [0.05, 0.014, 0.058], 0.018, { bone: toes, region: 'sole', k: 0.006 }));
  return P;
}
