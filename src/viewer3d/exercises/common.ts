import { Object3D, Quaternion, Vector3 } from 'three';
import { handFrame, sideSign, SIDES, type Side } from '../character/anatomy';
import type { Rig } from '../rig/rig';

export const V = (x: number, y: number, z: number) => new Vector3(x, y, z);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpV = (a: Vector3, b: Vector3, t: number) => a.clone().lerp(b, t);
export const deg = (d: number) => (d * Math.PI) / 180;

/** Pelvis root transform such that the hip-joint midpoint lands at `hipCenter`. */
export function rootFromHips(rig: Rig, hipCenter: Vector3, rotation: Quaternion): Vector3 {
  const hipBind = rig.bindHead('thigh_L').add(rig.bindHead('thigh_R')).multiplyScalar(0.5);
  const rootBind = rig.bindHead('pelvis');
  return hipCenter.clone().sub(hipBind.sub(rootBind).applyQuaternion(rotation));
}

/** Standing on the floor with feet about hip width, soft knees. */
export function standing(rig: Rig, opts: { lean?: number; breathe?: number; stance?: number; toeOut?: number } = {}): number {
  const lean = opts.lean ?? 0;
  const q = new Quaternion().setFromAxisAngle(V(1, 0, 0), lean * 0.6);
  rig.setRoot(V(0, 0.958 - Math.abs(lean) * 0.02, -lean * 0.06), q);
  const b = opts.breathe ?? 0;
  rig.setEuler('spine1', { x: lean * 0.25, y: 0, z: 0 });
  rig.setEuler('spine2', { x: lean * 0.15 - b * 0.01, y: 0, z: 0 });
  rig.setEuler('spine3', { x: -b * 0.015, y: 0, z: 0 });
  rig.setEuler('neck', { x: -lean * 0.5, y: 0, z: 0 });
  rig.setEuler('head', { x: -lean * 0.3, y: 0, z: 0 });
  rig.update();
  let err = 0;
  const stance = opts.stance ?? 0.118;
  const toe = opts.toeOut ?? 0.12;
  for (const side of SIDES) {
    const s = sideSign(side);
    const fwd = V(s * Math.sin(toe), 0, Math.cos(toe));
    const sole = V(s * stance, 0, 0.05);
    err = Math.max(err, rig.solveLeg(side, { ankle: rig.soleToAnkle(side, sole, fwd, V(0, 1, 0)), pole: V(s * 0.15, 0, 1), footForward: fwd, footUp: V(0, 1, 0) }));
  }
  return err;
}

/** Thumb axis (world) of a posed hand: the direction a gripped handle passes through the fist. */
export function thumbAxis(rig: Rig, side: Side): Vector3 {
  const hf = handFrame(side);
  return V(hf.w[0], hf.w[1], hf.w[2]).applyQuaternion(rig.worldQuat(`hand_${side}`)).normalize();
}

/** Place an object whose local +X is its handle axis at the hand's grip point. */
export function attachToGrip(obj: Object3D, rig: Rig, side: Side, flip = false): void {
  obj.position.copy(rig.gripPoint(side));
  const axis = thumbAxis(rig, side);
  if (flip) axis.negate();
  obj.quaternion.setFromUnitVectors(V(1, 0, 0), axis);
}
