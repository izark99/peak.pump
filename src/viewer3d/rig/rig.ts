import { Matrix4, Quaternion, Vector3 } from 'three';
import { BONES, FINGERS, handFrame, sideSign, type Finger, type Side } from '../character/anatomy';
import type { Vec3 } from '../sdf/primitives';

/**
 * Kinematic rig: forward kinematics over the code-defined skeleton plus analytic
 * two-bone IK for arms and legs. Bind orientations are identity, so a bone's world
 * rotation maps bind-pose world vectors to posed world vectors.
 */

const v3 = (a: Vec3) => new Vector3(a[0], a[1], a[2]);

export interface ArmGoal {
  /** World position of the wrist joint. Use `gripToWrist` to derive it from a handle. */
  wrist: Vector3;
  /** Direction the elbow should point toward. */
  pole: Vector3;
  /** Palm normal (world). */
  palm: Vector3;
  /** Finger direction (world), roughly perpendicular to palm. */
  fingers: Vector3;
}

export interface LegGoal {
  ankle: Vector3;
  /** Direction the knee should point toward. */
  pole: Vector3;
  footForward: Vector3;
  footUp: Vector3;
  /** Toe bend (rad, + = toes extended upward relative to the foot). */
  toeBend?: number;
}

export interface Euler3 {
  x: number;
  y: number;
  z: number;
}

/** Per-finger flexion at full grip (rad) for joints 1..3. */
const GRIP_ANGLES: Record<Finger, [number, number, number]> = {
  index: [1.2, 1.45, 0.9],
  middle: [1.25, 1.5, 0.9],
  ring: [1.25, 1.5, 0.9],
  pinky: [1.3, 1.45, 0.9],
  thumb: [0.35, 0.55, 0.6],
};
const RELAXED: Record<Finger, [number, number, number]> = {
  index: [0.2, 0.3, 0.15],
  middle: [0.25, 0.35, 0.18],
  ring: [0.3, 0.4, 0.2],
  pinky: [0.35, 0.45, 0.22],
  thumb: [0.1, 0.15, 0.1],
};

interface BoneState {
  name: string;
  parent: number;
  bindHead: Vector3;
  bindDir: Vector3;
  bindRef: Vector3;
  offset: Vector3;
  length: number;
  local: Quaternion;
  worldQ: Quaternion;
  worldP: Vector3;
}

const tmpQ = new Quaternion();
const tmpV = new Vector3();

function basisQuat(dir: Vector3, ref: Vector3): Quaternion {
  const d = dir.clone().normalize();
  const r = ref.clone().sub(d.clone().multiplyScalar(ref.dot(d)));
  if (r.lengthSq() < 1e-10) r.set(1, 0, 0).sub(d.clone().multiplyScalar(d.x));
  r.normalize();
  const c = new Vector3().crossVectors(d, r);
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(d, r, c));
}

/** Rotation that maps (dir0, ref0) onto (dir1, ref1). */
export function alignQuat(dir0: Vector3, ref0: Vector3, dir1: Vector3, ref1: Vector3): Quaternion {
  const q1 = basisQuat(dir1, ref1);
  const q0 = basisQuat(dir0, ref0);
  return q1.multiply(q0.invert());
}

export class Rig {
  readonly bones: BoneState[];
  private readonly index = new Map<string, number>();
  /** Grip point (handle centre) offset from the wrist in bind pose, per side. */
  readonly gripOffset: Record<Side, Vector3>;
  readonly soleOffset: Record<Side, Vector3>;

  constructor() {
    this.bones = BONES.map((b) => ({
      name: b.name,
      parent: -1,
      bindHead: v3(b.head),
      bindDir: v3(b.dir),
      bindRef: v3(b.ref),
      offset: new Vector3(),
      length: b.length,
      local: new Quaternion(),
      worldQ: new Quaternion(),
      worldP: v3(b.head),
    }));
    BONES.forEach((b, i) => this.index.set(b.name, i));
    BONES.forEach((b, i) => {
      const s = this.bones[i]!;
      s.parent = b.parent ? this.index.get(b.parent)! : -1;
      s.offset.copy(s.bindHead).sub(s.parent >= 0 ? this.bones[s.parent]!.bindHead : new Vector3());
    });
    const grip = (side: Side) => {
      const hf = handFrame(side);
      return v3(hf.at(0.08, 0.027, -0.002)).sub(v3(hf.W));
    };
    this.gripOffset = { L: grip('L'), R: grip('R') };
    const sole = (side: Side) => {
      const s = sideSign(side);
      return new Vector3(s * 0.114, 0.0, 0.06).sub(this.bindHead(`foot_${side}`));
    };
    this.soleOffset = { L: sole('L'), R: sole('R') };
    this.reset();
  }

  idx(name: string): number {
    const i = this.index.get(name);
    if (i === undefined) throw new Error(`Unknown bone ${name}`);
    return i;
  }
  bone(name: string): BoneState {
    return this.bones[this.idx(name)]!;
  }
  bindHead(name: string): Vector3 {
    return this.bone(name).bindHead.clone();
  }
  worldPos(name: string): Vector3 {
    return this.bone(name).worldP.clone();
  }
  worldQuat(name: string): Quaternion {
    return this.bone(name).worldQ.clone();
  }

  reset(): void {
    for (const b of this.bones) b.local.identity();
    this.rootPosition = this.bones[0]!.bindHead.clone();
    this.update();
  }

  rootPosition = new Vector3();

  setRoot(position: Vector3, rotation: Quaternion): void {
    this.rootPosition.copy(position);
    this.bones[0]!.local.copy(rotation);
  }

  setEuler(name: string, e: Euler3): void {
    const q = this.bone(name).local;
    // intrinsic Y (twist) then X (flexion) then Z (lateral)
    q.setFromAxisAngle(new Vector3(0, 1, 0), e.y);
    q.multiply(tmpQ.setFromAxisAngle(new Vector3(1, 0, 0), e.x));
    q.multiply(tmpQ.setFromAxisAngle(new Vector3(0, 0, 1), e.z));
  }

  /** Clavicle: elevation (+ = shrug up), protraction (+ = forward). */
  setClavicle(side: Side, elevation: number, protraction: number): void {
    const s = sideSign(side);
    const q = this.bone(`clavicle_${side}`).local;
    q.setFromAxisAngle(new Vector3(0, 0, 1), s * elevation);
    q.multiply(tmpQ.setFromAxisAngle(new Vector3(0, 1, 0), -s * protraction));
  }

  /** Recompute world transforms from local rotations (bones are ordered parent-first). */
  update(): void {
    for (const b of this.bones) {
      if (b.parent < 0) {
        b.worldQ.copy(b.local);
        b.worldP.copy(this.rootPosition);
      } else {
        const p = this.bones[b.parent]!;
        b.worldQ.copy(p.worldQ).multiply(b.local);
        b.worldP.copy(b.offset).applyQuaternion(p.worldQ).add(p.worldP);
      }
    }
  }

  private setWorld(i: number, worldQ: Quaternion): void {
    const b = this.bones[i]!;
    const parentQ = b.parent >= 0 ? this.bones[b.parent]!.worldQ : new Quaternion();
    b.local.copy(parentQ).invert().multiply(worldQ);
    b.worldQ.copy(worldQ);
    // children positions are refreshed by the next update()
  }

  /** World position of the handle centre given a hand orientation and wrist. Inverse of gripToWrist. */
  handQuat(side: Side, palm: Vector3, fingers: Vector3): Quaternion {
    const hf = handFrame(side);
    return alignQuat(v3(hf.u), v3(hf.p), fingers, palm);
  }

  gripToWrist(side: Side, grip: Vector3, palm: Vector3, fingers: Vector3): Vector3 {
    return grip.clone().sub(this.gripOffset[side].clone().applyQuaternion(this.handQuat(side, palm, fingers)));
  }

  gripPoint(side: Side): Vector3 {
    const h = this.bone(`hand_${side}`);
    return this.gripOffset[side].clone().applyQuaternion(h.worldQ).add(h.worldP);
  }

  footQuat(forward: Vector3, up: Vector3): Quaternion {
    return alignQuat(new Vector3(0, 0, 1), new Vector3(0, 1, 0), forward, up);
  }

  soleToAnkle(side: Side, sole: Vector3, forward: Vector3, up: Vector3): Vector3 {
    return sole.clone().sub(this.soleOffset[side].clone().applyQuaternion(this.footQuat(forward, up)));
  }

  solePoint(side: Side): Vector3 {
    const f = this.bone(`foot_${side}`);
    return this.soleOffset[side].clone().applyQuaternion(f.worldQ).add(f.worldP);
  }

  /**
   * Analytic two-bone IK. Returns the distance between the requested and achieved end
   * position (0 when reachable).
   */
  private twoBone(
    rootName: string,
    midName: string,
    endName: string,
    target: Vector3,
    pole: Vector3,
    flexSideIsPole: boolean,
    midRef: Vector3,
  ): { error: number; mid: Vector3; end: Vector3 } {
    this.update();
    const root = this.bone(rootName);
    const mid = this.bone(midName);
    const L1 = root.length;
    const L2 = mid.length;
    const S = root.worldP.clone();
    const D = target.clone().sub(S);
    const want = D.length();
    const dist = Math.min(Math.max(want, Math.abs(L1 - L2) + 1e-4), L1 + L2 - 1e-4);
    const n = D.clone().normalize();
    const b = pole.clone().sub(n.clone().multiplyScalar(pole.dot(n)));
    if (b.lengthSq() < 1e-10) b.set(0, 0, -1);
    b.normalize();
    const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const E = S.clone().add(n.clone().multiplyScalar(a)).add(b.clone().multiplyScalar(h));
    const W = S.clone().add(n.clone().multiplyScalar(dist));
    const d1 = E.clone().sub(S).normalize();
    // limb ref (anterior): arms flex away from the elbow pole, knees flex toward the back (pole = front)
    const r1 = flexSideIsPole ? b.clone() : b.clone().negate();
    this.setWorld(this.idx(rootName), alignQuat(root.bindDir, root.bindRef, d1, r1));
    const d2 = W.clone().sub(E).normalize();
    this.setWorld(this.idx(midName), alignQuat(mid.bindDir, mid.bindRef, d2, midRef));
    this.update();
    void endName;
    return { error: Math.max(0, want - dist, Math.abs(L1 - L2) - want), mid: E, end: W };
  }

  solveArm(side: Side, goal: ArmGoal): number {
    const s = sideSign(side);
    const palm = goal.palm.clone().normalize();
    const fingers = goal.fingers.clone().sub(palm.clone().multiplyScalar(goal.fingers.dot(palm))).normalize();
    const thumb = new Vector3().crossVectors(palm, fingers).multiplyScalar(s);
    const res = this.twoBone(`upperArm_${side}`, `forearm_${side}`, `hand_${side}`, goal.wrist, goal.pole, false, thumb);
    this.setWorld(this.idx(`hand_${side}`), this.handQuat(side, palm, fingers));
    this.update();
    return res.error;
  }

  solveLeg(side: Side, goal: LegGoal): number {
    const res = this.twoBone(`thigh_${side}`, `shin_${side}`, `foot_${side}`, goal.ankle, goal.pole, true, goal.pole);
    this.setWorld(this.idx(`foot_${side}`), this.footQuat(goal.footForward.clone().normalize(), goal.footUp.clone().normalize()));
    this.bone(`toes_${side}`).local.setFromAxisAngle(new Vector3(1, 0, 0), -(goal.toeBend ?? 0));
    this.update();
    return res.error;
  }

  /** grip: 0 = relaxed open hand, 1 = closed around a ~3 cm handle. */
  setGrip(side: Side, grip: number, thumbOpposed = true): void {
    for (const f of [...FINGERS, 'thumb'] as Finger[]) {
      for (let i = 0; i < 3; i++) {
        const b = this.bone(`${f}${i + 1}_${side}`);
        const axis = tmpV.crossVectors(b.bindDir, b.bindRef).normalize();
        let ang = RELAXED[f][i]! + (GRIP_ANGLES[f][i]! - RELAXED[f][i]!) * grip;
        if (f === 'thumb' && !thumbOpposed) ang *= 0.4;
        b.local.setFromAxisAngle(axis, ang);
      }
    }
  }
}
