/**
 * Muscle taxonomy used for 3D highlight and dashboard statistics.
 * Primary/secondary assignments describe the *targeted* muscles only —
 * they are not measured activation levels (no EMG simulation).
 */
export const MUSCLE_IDS = [
  'chest',
  'front_delts',
  'side_delts',
  'rear_delts',
  'upper_traps',
  'upper_back',
  'lats',
  'lower_back',
  'biceps',
  'brachialis',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'glutes',
  'glute_med',
  'quads',
  'hamstrings',
  'adductors',
  'gastrocnemius',
  'soleus',
] as const;

export type MuscleId = (typeof MUSCLE_IDS)[number];

export type MuscleGroupId = 'chest' | 'shoulders' | 'back' | 'arms' | 'core' | 'glutes' | 'legs' | 'calves';

export interface MuscleInfo {
  id: MuscleId;
  group: MuscleGroupId;
  name: { vi: string; en: string };
}

export const MUSCLES: Record<MuscleId, MuscleInfo> = {
  chest: { id: 'chest', group: 'chest', name: { vi: 'Ngực', en: 'Chest' } },
  front_delts: { id: 'front_delts', group: 'shoulders', name: { vi: 'Vai trước', en: 'Front delts' } },
  side_delts: { id: 'side_delts', group: 'shoulders', name: { vi: 'Vai giữa', en: 'Side delts' } },
  rear_delts: { id: 'rear_delts', group: 'shoulders', name: { vi: 'Vai sau', en: 'Rear delts' } },
  upper_traps: { id: 'upper_traps', group: 'back', name: { vi: 'Cầu vai trên', en: 'Upper traps' } },
  upper_back: { id: 'upper_back', group: 'back', name: { vi: 'Lưng giữa', en: 'Upper back' } },
  lats: { id: 'lats', group: 'back', name: { vi: 'Cơ xô', en: 'Lats' } },
  lower_back: { id: 'lower_back', group: 'back', name: { vi: 'Lưng dưới', en: 'Lower back' } },
  biceps: { id: 'biceps', group: 'arms', name: { vi: 'Cơ nhị đầu', en: 'Biceps' } },
  brachialis: { id: 'brachialis', group: 'arms', name: { vi: 'Cơ cánh tay', en: 'Brachialis' } },
  triceps: { id: 'triceps', group: 'arms', name: { vi: 'Cơ tam đầu', en: 'Triceps' } },
  forearms: { id: 'forearms', group: 'arms', name: { vi: 'Cẳng tay', en: 'Forearms' } },
  abs: { id: 'abs', group: 'core', name: { vi: 'Cơ bụng', en: 'Abs' } },
  obliques: { id: 'obliques', group: 'core', name: { vi: 'Cơ liên sườn', en: 'Obliques' } },
  glutes: { id: 'glutes', group: 'glutes', name: { vi: 'Cơ mông lớn', en: 'Glutes' } },
  glute_med: { id: 'glute_med', group: 'glutes', name: { vi: 'Cơ mông nhỡ', en: 'Glute medius' } },
  quads: { id: 'quads', group: 'legs', name: { vi: 'Đùi trước', en: 'Quadriceps' } },
  hamstrings: { id: 'hamstrings', group: 'legs', name: { vi: 'Đùi sau', en: 'Hamstrings' } },
  adductors: { id: 'adductors', group: 'legs', name: { vi: 'Cơ khép đùi', en: 'Adductors' } },
  gastrocnemius: { id: 'gastrocnemius', group: 'calves', name: { vi: 'Cơ bụng chân', en: 'Gastrocnemius' } },
  soleus: { id: 'soleus', group: 'calves', name: { vi: 'Cơ dép', en: 'Soleus' } },
};

export function muscleIndex(id: MuscleId): number {
  return MUSCLE_IDS.indexOf(id);
}
