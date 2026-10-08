import { Group, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import { sideSign, SIDES } from '../character/anatomy';
import { box, cableLine, createMaterials, disposeObject, placeBetween, pulley, tube, weightStack, type EquipmentMaterials } from '../equipment/parts';
import type { Rig } from '../rig/rig';
import { deg, lerp, lerpV, rootFromHips, V } from './common';
import type { ContactReport, EquipmentSet, ExerciseAnimation } from './types';

const SEAT_TOP = 0.45;
const PLATE_TILT = deg(20);
const PLATE_CENTER = V(0, 0.25, 0.8);
const PULLEY = V(0, 0.34, 0.9);
const STACK_Z = 1.32;
const GRIP_HALF = 0.052;

const plateUp = V(0, Math.cos(PLATE_TILT), Math.sin(PLATE_TILT));
const plateNormal = V(0, Math.sin(PLATE_TILT), -Math.cos(PLATE_TILT));

interface RowEquipment extends EquipmentSet {
  handle: Group;
  cable: Mesh;
  stack: ReturnType<typeof weightStack>;
  restLength: number;
}

function vHandle(m: EquipmentMaterials): Group {
  // local frame: grips along Y at x=±GRIP_HALF, apex toward +Z (the pulley)
  const g = new Group();
  for (const s of [-1, 1]) {
    g.add(tube(V(s * GRIP_HALF, -0.06, 0), V(s * GRIP_HALF, 0.06, 0), 0.016, m.rubber));
    g.add(tube(V(s * GRIP_HALF, 0.06, 0), V(0, 0.0, 0.16), 0.009, m.chrome));
    g.add(tube(V(s * GRIP_HALF, -0.06, 0), V(0, 0.0, 0.16), 0.009, m.chrome));
  }
  g.add(tube(V(0, 0, 0.16), V(0, 0, 0.2), 0.007, m.chrome));
  return g;
}

function rowStation(m: EquipmentMaterials) {
  const g = new Group();
  const rail = box([0.14, 0.06, 1.85], m.frame, 0.01);
  rail.position.set(0, 0.03, 0.45);
  g.add(rail);
  const seat = box([0.34, 0.07, 0.44], m.pad, 0.025);
  seat.position.set(0, SEAT_TOP - 0.035, -0.02);
  g.add(seat);
  g.add(tube(V(0, 0.06, -0.02), V(0, SEAT_TOP - 0.07, -0.02), 0.035, m.frame));
  const plate = box([0.5, 0.34, 0.03], m.frame, 0.008);
  plate.position.copy(PLATE_CENTER);
  plate.rotation.x = PLATE_TILT;
  g.add(plate);
  for (const s of [-1, 1]) {
    const grip = box([0.2, 0.3, 0.012], m.rubber, 0.004);
    grip.position.copy(PLATE_CENTER).add(plateNormal.clone().multiplyScalar(0.02)).add(V(s * 0.13, 0, 0));
    grip.rotation.x = PLATE_TILT;
    g.add(grip);
    g.add(tube(V(s * 0.22, 0.04, 0.86), PLATE_CENTER.clone().add(V(s * 0.22, 0.12, 0.05)), 0.018, m.frame));
  }
  // tower
  for (const s of [-1, 1]) {
    const up = box([0.07, 2.0, 0.07], m.frame, 0.008);
    up.position.set(s * 0.2, 1.0, STACK_Z);
    g.add(up);
  }
  const cap = box([0.48, 0.07, 0.12], m.frame, 0.01);
  cap.position.set(0, 2.0, STACK_Z);
  g.add(cap);
  const shroud = box([0.42, 0.012, 0.16], m.accent, 0.004);
  shroud.position.set(0, 1.25, STACK_Z - 0.07);
  g.add(shroud);
  const stack = weightStack(m, 16, 7);
  stack.group.position.set(0, 0, STACK_Z);
  g.add(stack.group);
  // pulley train (static segments)
  const p1 = pulley(m);
  p1.position.copy(PULLEY);
  p1.rotation.y = Math.PI / 2;
  g.add(p1);
  const p2 = pulley(m);
  p2.position.set(0, 0.06, PULLEY.z + 0.05);
  p2.rotation.y = Math.PI / 2;
  g.add(p2);
  g.add(tube(V(0, 0.015, PULLEY.z + 0.05), V(0, 0.015, STACK_Z), 0.0035, m.cable));
  g.add(tube(PULLEY.clone().add(V(0, -0.04, 0.0)), V(0, 0.06, PULLEY.z + 0.05), 0.0035, m.cable));
  return { group: g, stack };
}

const STRETCH = V(0, 0.69, 0.6);
const CONTRACT = V(0, 0.735, 0.2);

/** Seated cable row with V-handle: reach and protract at the stretch, row to the abdomen while retracting. */
export const seatedCableRow: ExerciseAnimation<RowEquipment> = {
  id: 'seated_cable_row',
  phases: [
    { name: 'concentric', duration: 1.1, from: 0, to: 1 },
    { name: 'hold_top', duration: 0.4, from: 1, to: 1 },
    { name: 'eccentric', duration: 1.7, from: 1, to: 0 },
    { name: 'hold_bottom', duration: 0.3, from: 0, to: 0 },
  ],
  camera: { target: [0, 0.75, 0.35], distance: 3.2, azimuth: 1.25, elevation: 0.22 },
  createEquipment() {
    const m = createMaterials();
    const group = new Group();
    const station = rowStation(m);
    group.add(station.group);
    const handle = vHandle(m);
    group.add(handle);
    const cable = cableLine(m);
    group.add(cable);
    const restLength = STRETCH.distanceTo(PULLEY) - 0.03;
    return { group, handle, cable, stack: station.stack, restLength, dispose: () => disposeObject(group) };
  },
  pose(r: number, rig: Rig, eq: RowEquipment) {
    rig.reset();
    const lean = lerp(deg(15), deg(-5), r);
    const rot = new Quaternion().setFromAxisAngle(V(1, 0, 0), lean);
    const hips = V(0, SEAT_TOP + 0.098, 0.0);
    rig.setRoot(rootFromHips(rig, hips, rot), rot);
    rig.setEuler('spine1', { x: lerp(deg(4), 0, r), y: 0, z: 0 });
    rig.setEuler('spine2', { x: lerp(deg(6), deg(-2), r), y: 0, z: 0 });
    rig.setEuler('spine3', { x: lerp(deg(4), deg(-3), r), y: 0, z: 0 });
    rig.setEuler('neck', { x: lerp(deg(-12), deg(2), r), y: 0, z: 0 });
    rig.setEuler('head', { x: lerp(deg(-6), 0, r), y: 0, z: 0 });
    rig.update();

    const mid = lerpV(STRETCH, CONTRACT, r);
    mid.y += Math.sin(Math.PI * r) * 0.012;
    const toPulley = PULLEY.clone().sub(mid).normalize();
    const contacts: ContactReport[] = [];
    for (const side of SIDES) {
      const s = sideSign(side);
      rig.setClavicle(side, 0.02, lerp(0.2, -0.16, r));
      rig.update();
      const grip = mid.clone().add(V(s * GRIP_HALF, 0, 0));
      const palm = V(-s, 0, 0);
      const fingers = V(s * 0.12, -0.25, 1);
      const wrist = rig.gripToWrist(side, grip, palm, fingers);
      rig.solveArm(side, { wrist, pole: V(s * 0.3, -0.4, -1), palm, fingers });
      rig.setGrip(side, 1);
      rig.update();
      contacts.push({ name: `grip_${side}`, error: rig.gripPoint(side).distanceTo(grip) });
    }
    const surface = PLATE_CENTER.clone().add(plateNormal.clone().multiplyScalar(0.03));
    for (const side of SIDES) {
      const s = sideSign(side);
      const sole = surface.clone().add(V(s * 0.12, 0, 0)).add(plateUp.clone().multiplyScalar(-0.03));
      rig.solveLeg(side, { ankle: rig.soleToAnkle(side, sole, plateUp, plateNormal), pole: V(s * 0.25, 1, 0.3), footForward: plateUp, footUp: plateNormal });
      contacts.push({ name: `sole_${side}`, error: rig.solePoint(side).distanceTo(sole) });
    }
    rig.update();
    // handle: grips through both fists, apex toward the pulley
    eq.handle.position.copy(mid);
    const zAxis = toPulley;
    const xAxis = V(1, 0, 0);
    const yAxis = new Vector3().crossVectors(zAxis, xAxis).normalize();
    const fixedX = new Vector3().crossVectors(yAxis, zAxis).normalize();
    eq.handle.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(fixedX, yAxis, zAxis));
    const apex = V(0, 0, 0.2).applyQuaternion(eq.handle.quaternion).add(mid);
    placeBetween(eq.cable, apex, PULLEY);
    eq.stack.setLift(apex.distanceTo(PULLEY) - eq.restLength);
    return contacts;
  },
};
