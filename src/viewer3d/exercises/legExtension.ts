import { Group, Quaternion } from 'three';
import { sideSign, SIDES } from '../character/anatomy';
import { box, createMaterials, disposeObject, mesh, tube, weightStack, type EquipmentMaterials } from '../equipment/parts';
import { CylinderGeometry } from 'three';
import type { Rig } from '../rig/rig';
import { deg, lerp, rootFromHips, V } from './common';
import type { ContactReport, EquipmentSet, ExerciseAnimation } from './types';

const SEAT_TOP = 0.5;
const PIVOT = V(0, 0.565, 0.25);
const SHIN = 0.415;
const ROLLER_ALONG = 0.355;
const ROLLER_OFFSET = 0.078;
const BACK_TILT = deg(-12);

interface LegExtEquipment extends EquipmentSet {
  lever: Group;
  stack: ReturnType<typeof weightStack>;
}

function machine(m: EquipmentMaterials) {
  const g = new Group();
  const base = box([0.62, 0.06, 1.2], m.frame, 0.012);
  base.position.set(0, 0.03, -0.15);
  g.add(base);
  const seat = box([0.4, 0.08, 0.44], m.pad, 0.03);
  seat.position.set(0, SEAT_TOP - 0.04, -0.03);
  g.add(seat);
  g.add(tube(V(0, 0.06, -0.05), V(0, SEAT_TOP - 0.08, -0.05), 0.04, m.frame));
  const back = box([0.38, 0.58, 0.08], m.pad, 0.03);
  back.position.set(0, 0.84, -0.37);
  back.rotation.x = BACK_TILT;
  g.add(back);
  g.add(tube(V(0, 0.06, -0.42), V(0, 0.7, -0.44), 0.035, m.frame));
  // side frame + handles
  for (const s of [-1, 1]) {
    g.add(tube(V(s * 0.27, 0.06, -0.15), V(s * 0.27, 0.47, -0.15), 0.02, m.frame));
    g.add(tube(V(s * 0.27, 0.47, -0.2), V(s * 0.27, 0.47, 0.08), 0.017, m.rubber));
  }
  // pivot post on the right side
  g.add(tube(V(-0.3, 0.06, 0.25), V(-0.3, PIVOT.y, 0.25), 0.035, m.frame));
  const hub = mesh(new CylinderGeometry(0.06, 0.06, 0.05, 28), m.accent);
  hub.rotation.z = Math.PI / 2;
  hub.position.set(-0.3, PIVOT.y, PIVOT.z);
  g.add(hub);
  // stack tower behind
  for (const s of [-1, 1]) {
    const up = box([0.06, 1.5, 0.06], m.frame, 0.008);
    up.position.set(s * 0.19 - 0.6, 0.75, -0.62);
    g.add(up);
  }
  const stack = weightStack(m, 14, 6);
  stack.group.position.set(-0.6, 0, -0.62);
  g.add(stack.group);
  // lever: origin at the pivot axis, arm on the right side, roller across the shins
  const lever = new Group();
  lever.position.copy(PIVOT);
  lever.add(tube(V(-0.3, 0, 0), V(-0.3, -ROLLER_ALONG, ROLLER_OFFSET), 0.022, m.frame));
  lever.add(tube(V(-0.3, -ROLLER_ALONG, ROLLER_OFFSET), V(-0.17, -ROLLER_ALONG, ROLLER_OFFSET), 0.015, m.chrome));
  const roller = mesh(new CylinderGeometry(0.045, 0.045, 0.34, 28), m.pad);
  roller.rotation.z = Math.PI / 2;
  roller.position.set(0, -ROLLER_ALONG, ROLLER_OFFSET);
  lever.add(roller);
  g.add(lever);
  return { group: g, lever, stack };
}

/** Leg extension: knees aligned with the machine pivot, extend to near lockout, controlled return. */
export const legExtension: ExerciseAnimation<LegExtEquipment> = {
  id: 'leg_extension',
  phases: [
    { name: 'concentric', duration: 1.1, from: 0, to: 1 },
    { name: 'hold_top', duration: 0.45, from: 1, to: 1 },
    { name: 'eccentric', duration: 1.7, from: 1, to: 0 },
    { name: 'hold_bottom', duration: 0.3, from: 0, to: 0 },
  ],
  camera: { target: [0, 0.65, 0.05], distance: 2.9, azimuth: 1.15, elevation: 0.2 },
  createEquipment() {
    const m = createMaterials();
    const group = new Group();
    const mc = machine(m);
    group.add(mc.group);
    return { group, lever: mc.lever, stack: mc.stack, dispose: () => disposeObject(group) };
  },
  pose(r: number, rig: Rig, eq: LegExtEquipment) {
    rig.reset();
    const theta = lerp(deg(-6), deg(80), r);
    const thighLen = rig.bone('thigh_L').length;
    const dy = rig.bone('thigh_L').bindHead.y - SEAT_TOP;
    void dy;
    const hipY = SEAT_TOP + 0.098;
    const hipZ = PIVOT.z - Math.sqrt(thighLen * thighLen - (hipY - PIVOT.y) ** 2);
    const rot = new Quaternion().setFromAxisAngle(V(1, 0, 0), BACK_TILT);
    rig.setRoot(rootFromHips(rig, V(0, hipY, hipZ), rot), rot);
    rig.setEuler('spine2', { x: deg(2), y: 0, z: 0 });
    rig.setEuler('spine3', { x: deg(2), y: 0, z: 0 });
    rig.setEuler('neck', { x: deg(8), y: 0, z: 0 });
    rig.setEuler('head', { x: deg(4), y: 0, z: 0 });
    rig.update();
    const contacts: ContactReport[] = [];
    const shinDir = V(0, -Math.cos(theta), Math.sin(theta));
    const fwd = V(0, Math.sin(theta), Math.cos(theta));
    const up = V(0, Math.cos(theta), -Math.sin(theta));
    for (const side of SIDES) {
      const s = sideSign(side);
      const hip = rig.worldPos(`thigh_${side}`);
      const knee = V(hip.x + s * 0.004, PIVOT.y, PIVOT.z);
      const ankle = knee.clone().add(shinDir.clone().multiplyScalar(SHIN));
      rig.solveLeg(side, { ankle, pole: V(s * 0.08, 1, 0.25), footForward: fwd, footUp: up, toeBend: deg(-6) });
      contacts.push({ name: `knee_pivot_${side}`, error: rig.worldPos(`shin_${side}`).distanceTo(knee) });
      // hands on the side handles
      rig.setClavicle(side, -0.02, 0.0);
      rig.update();
      const grip = V(s * 0.27, 0.47, -0.04);
      const palm = V(-s, -0.25, 0).normalize();
      const fingers = V(s * 0.1, -1, 0.05);
      const wrist = rig.gripToWrist(side, grip, palm, fingers);
      rig.solveArm(side, { wrist, pole: V(s * 0.4, 0, -1), palm, fingers });
      rig.setGrip(side, 1);
      rig.update();
      contacts.push({ name: `grip_${side}`, error: rig.gripPoint(side).distanceTo(grip) });
    }
    eq.lever.rotation.x = -theta;
    eq.stack.setLift((theta - deg(-6)) * 0.085);
    return contacts;
  },
};
