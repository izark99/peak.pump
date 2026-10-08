import { Group, Quaternion, Vector3 } from 'three';
import { sideSign, SIDES } from '../character/anatomy';
import { barbell, box, createMaterials, disposeObject, tube, type EquipmentMaterials } from '../equipment/parts';
import type { Rig } from '../rig/rig';
import { deg, lerp, lerpV, V } from './common';
import type { ContactReport, EquipmentSet, ExerciseAnimation } from './types';

export const BENCH_TOP = 0.44;

/** Flat bench: pad from z=-0.9 to z=0.3, pad top at BENCH_TOP. */
export function flatBench(m: EquipmentMaterials): Group {
  const g = new Group();
  g.name = 'flatBench';
  const pad = box([0.29, 0.07, 1.2], m.pad, 0.03);
  pad.position.set(0, BENCH_TOP - 0.035, -0.3);
  g.add(pad);
  const beam = box([0.08, 0.05, 1.08], m.frame, 0.01);
  beam.position.set(0, BENCH_TOP - 0.1, -0.3);
  g.add(beam);
  for (const z of [0.2, -0.8]) {
    g.add(tube(V(0, 0.03, z), V(0, BENCH_TOP - 0.1, z), 0.03, m.frame));
    const foot = box([0.5, 0.04, 0.07], m.frame, 0.012);
    foot.position.set(0, 0.02, z);
    g.add(foot);
    for (const s of [-1, 1]) {
      const cap = box([0.06, 0.012, 0.075], m.rubber, 0.004);
      cap.position.set(s * 0.22, 0.006, z);
      g.add(cap);
    }
  }
  return g;
}

function benchRack(m: EquipmentMaterials, z: number, hookY: number): Group {
  const g = new Group();
  for (const s of [-1, 1]) {
    const up = box([0.06, 1.3, 0.06], m.frame, 0.008);
    up.position.set(s * 0.58, 0.65, z);
    g.add(up);
    const base = box([0.09, 0.05, 0.62], m.frame, 0.01);
    base.position.set(s * 0.58, 0.025, z + 0.05);
    g.add(base);
    const hook = box([0.05, 0.03, 0.09], m.accent, 0.006);
    hook.position.set(s * 0.58, hookY - 0.03, z + 0.06);
    g.add(hook);
    const lip = box([0.05, 0.05, 0.015], m.accent, 0.004);
    lip.position.set(s * 0.58, hookY, z + 0.1);
    g.add(lip);
  }
  const brace = box([1.22, 0.05, 0.05], m.frame, 0.01);
  brace.position.set(0, 0.08, z - 0.2);
  g.add(brace);
  return g;
}

interface BenchEquipment extends EquipmentSet {
  bar: Group;
}

const GRIP_HALF_WIDTH = 0.4;
const LOCKOUT = V(0, 1.035, -0.31);
const BOTTOM = V(0, 0.71, -0.2);

/** Flat barbell bench press: controlled descent to the lower chest, press back to lockout over the shoulders. */
export const barbellBenchPress: ExerciseAnimation<BenchEquipment> = {
  id: 'barbell_bench_press',
  phases: [
    { name: 'hold_top', duration: 0.4, from: 0, to: 0 },
    { name: 'eccentric', duration: 1.7, from: 0, to: 1 },
    { name: 'hold_bottom', duration: 0.25, from: 1, to: 1 },
    { name: 'concentric', duration: 1.1, from: 1, to: 0 },
  ],
  camera: { target: [0, 0.65, -0.2], distance: 3.0, azimuth: 1.05, elevation: 0.32 },
  createEquipment() {
    const m = createMaterials();
    const group = new Group();
    group.add(flatBench(m));
    group.add(benchRack(m, -0.5, 1.0));
    const bar = barbell(m, [
      [0.225, 0.045],
      [0.2, 0.032],
    ]);
    group.add(bar);
    return { group, bar, dispose: () => disposeObject(group) };
  },
  pose(r: number, rig: Rig, eq: BenchEquipment) {
    rig.reset();
    const lying = new Quaternion().setFromAxisAngle(V(1, 0, 0), deg(-90));
    rig.setRoot(V(0, BENCH_TOP + 0.113, 0.16), lying);
    rig.setEuler('spine1', { x: deg(-4), y: 0, z: 0 });
    rig.setEuler('spine2', { x: deg(-4) - r * deg(1.5), y: 0, z: 0 });
    rig.setEuler('spine3', { x: deg(-2), y: 0, z: 0 });
    rig.setEuler('neck', { x: deg(4), y: 0, z: 0 });
    rig.setEuler('head', { x: deg(2), y: 0, z: 0 });
    rig.update();

    // bar path: slight J-curve from over the shoulders to the lower chest
    const t = r;
    const bar = lerpV(LOCKOUT, BOTTOM, t);
    bar.z += Math.sin(Math.PI * t) * 0.025;
    const contacts: ContactReport[] = [];
    for (const side of SIDES) {
      const s = sideSign(side);
      rig.setClavicle(side, lerp(0.0, -0.03, r), lerp(0.02, -0.1, r));
      rig.update();
      const grip = bar.clone().add(V(s * GRIP_HALF_WIDTH, 0, 0));
      const palm = V(0, 0.32, 0.95).normalize();
      const fingers = V(0, 0.95, -0.32);
      const wrist = rig.gripToWrist(side, grip, palm, fingers);
      rig.solveArm(side, { wrist, pole: V(s * 0.85, -0.5, 0.35), palm, fingers });
      rig.setGrip(side, 1);
      rig.update();
      contacts.push({ name: `grip_${side}`, error: rig.gripPoint(side).distanceTo(grip) });
    }
    // feet planted on the floor
    for (const side of SIDES) {
      const s = sideSign(side);
      const fwd = V(s * 0.3, 0, 1).normalize();
      const sole = V(s * 0.27, 0, 0.6);
      rig.solveLeg(side, { ankle: rig.soleToAnkle(side, sole, fwd, V(0, 1, 0)), pole: V(s * 0.45, 1, 0.6), footForward: fwd, footUp: V(0, 1, 0) });
      contacts.push({ name: `sole_${side}`, error: rig.solePoint(side).distanceTo(sole) });
    }
    rig.update();
    eq.bar.position.copy(bar);
    eq.bar.quaternion.identity();
    return contacts;
  },
};

export const _testing = { LOCKOUT, BOTTOM, GRIP_HALF_WIDTH, vec: (v: Vector3) => v.toArray() };
