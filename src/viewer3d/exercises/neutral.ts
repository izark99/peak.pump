import { Group } from 'three';
import { sideSign, SIDES } from '../character/anatomy';
import type { Rig } from '../rig/rig';
import { standing, V } from './common';
import type { EquipmentSet, ExerciseAnimation } from './types';

/** Neutral standing pose with subtle breathing (character review pose, not a catalog exercise). */
export const neutralStance: ExerciseAnimation = {
  id: 'neutral_stance',
  phases: [
    { name: 'idle', duration: 2.4, from: 0, to: 1 },
    { name: 'idle', duration: 2.8, from: 1, to: 0 },
  ],
  camera: { target: [0, 1.0, 0], distance: 3.4, azimuth: 0.35, elevation: 0.08 },
  createEquipment(): EquipmentSet {
    return { group: new Group(), dispose() {} };
  },
  pose(r: number, rig: Rig) {
    rig.reset();
    standing(rig, { breathe: r });
    for (const side of SIDES) {
      const s = sideSign(side);
      rig.setClavicle(side, 0.0 + r * 0.01, 0.0);
      rig.update();
      const S = rig.worldPos(`upperArm_${side}`);
      const wrist = S.clone().add(V(s * 0.07, -0.545, 0.035));
      rig.solveArm(side, { wrist, pole: V(s * 0.35, 0, -1), palm: V(-s, 0, 0.25), fingers: V(s * 0.05, -1, 0.08) });
      rig.setGrip(side, 0.05);
    }
    rig.update();
    return [];
  },
};
