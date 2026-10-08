import { barbellBenchPress } from './benchPress';
import { dumbbellLateralRaise } from './lateralRaise';
import { legExtension } from './legExtension';
import { neutralStance } from './neutral';
import { seatedCableRow } from './seatedCableRow';
import type { ExerciseAnimation } from './types';

/** Animations implemented so far. Phase 5 must cover every catalog exercise. */
export const ANIMATIONS: Readonly<Record<string, ExerciseAnimation>> = Object.fromEntries(
  ([neutralStance, dumbbellLateralRaise, barbellBenchPress, seatedCableRow, legExtension] as ExerciseAnimation[]).map((a) => [a.id, a]),
);
