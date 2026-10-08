import { Group, Vector3 } from 'three';
import { sideSign, SIDES, type Side } from '../character/anatomy';
import { createMaterials, disposeObject, dumbbell } from '../equipment/parts';
import type { Rig } from '../rig/rig';
import { attachToGrip, deg, lerp, standing, V } from './common';
import type { EquipmentSet, ExerciseAnimation } from './types';

interface LateralRaiseEquipment extends EquipmentSet {
  dumbbells: Record<Side, Group>;
}

const MAX_ABDUCTION = deg(80);
const SCAPULAR_PLANE = deg(22);

/** Standing dumbbell lateral raise: abduction in the scapular plane, soft elbows, lead with the elbows. */
export const dumbbellLateralRaise: ExerciseAnimation<LateralRaiseEquipment> = {
  id: 'dumbbell_lateral_raise',
  phases: [
    { name: 'concentric', duration: 1.1, from: 0, to: 1 },
    { name: 'hold_top', duration: 0.35, from: 1, to: 1 },
    { name: 'eccentric', duration: 1.7, from: 1, to: 0 },
    { name: 'hold_bottom', duration: 0.45, from: 0, to: 0 },
  ],
  camera: { target: [0, 1.05, 0], distance: 3.3, azimuth: 0.0, elevation: 0.08 },
  createEquipment() {
    const m = createMaterials();
    const group = new Group();
    const dumbbells = { L: dumbbell(m, 0.052, 0.06), R: dumbbell(m, 0.052, 0.06) };
    group.add(dumbbells.L, dumbbells.R);
    return { group, dumbbells, dispose: () => disposeObject(group) };
  },
  pose(r: number, rig: Rig, eq: LateralRaiseEquipment) {
    rig.reset();
    standing(rig, { lean: deg(6) });
    const theta = lerp(deg(9), MAX_ABDUCTION, r);
    const contacts = [];
    for (const side of SIDES) {
      const s = sideSign(side);
      rig.setClavicle(side, lerp(0.0, 0.07, r * r), lerp(0.02, 0.0, r));
      rig.update();
      const S = rig.worldPos(`upperArm_${side}`);
      // arm direction in the scapular plane, slightly ahead of the frontal plane
      const dir = new Vector3(s * Math.sin(theta) * Math.cos(SCAPULAR_PLANE), -Math.cos(theta), Math.sin(theta) * Math.sin(SCAPULAR_PLANE) + 0.06).normalize();
      const reach = 0.548; // ~15° elbow bend
      const wrist = S.clone().add(dir.clone().multiplyScalar(reach));
      // palms face the thighs at the bottom and the floor at the top
      const palm = V(-s, 0, 0.1).lerp(V(-s * 0.15, -1, 0), Math.min(1, r * 1.15)).normalize();
      const fingers = dir.clone().add(V(0, -0.15, 0.1));
      const err = rig.solveArm(side, { wrist, pole: V(s * 0.1, 0.25 + 0.6 * r, -1), palm, fingers });
      rig.setGrip(side, 1);
      contacts.push({ name: `wrist_${side}`, error: err });
    }
    rig.update();
    for (const side of SIDES) attachToGrip(eq.dumbbells[side], rig, side);
    return contacts;
  },
};
