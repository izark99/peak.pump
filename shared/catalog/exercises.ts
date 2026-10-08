import type { MuscleId } from './muscles';

/**
 * Exercise catalog approved at gate 1 (docs/EXERCISE_SOURCES.md, D-013).
 * IDs are stable forever: never rename or reuse; retire instead.
 * Long-form bilingual content (setup, steps, mistakes, notes) is added in phase 5.
 */
export const CATALOG_VERSION = 1;

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'bench'
  | 'rack'
  | 'pullup_bar'
  | 'dip_bars'
  | 'treadmill'
  | 'stationary_bike';

export type MovementPattern =
  | 'horizontal_push'
  | 'incline_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'chest_fly'
  | 'shoulder_abduction'
  | 'rear_delt_fly'
  | 'elbow_flexion'
  | 'elbow_extension'
  | 'squat'
  | 'lunge'
  | 'knee_extension'
  | 'knee_flexion'
  | 'hip_hinge'
  | 'hip_extension'
  | 'hip_abduction'
  | 'plantar_flexion'
  | 'spinal_flexion'
  | 'hip_flexion'
  | 'shoulder_extension'
  | 'cardio_gait'
  | 'cardio_cycle';

export type LoadMode = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight' | 'cardio';

export type CardioField = 'duration_s' | 'distance_km' | 'speed_kmh' | 'incline_pct';

export interface CatalogExercise {
  id: string;
  name: { vi: string; en: string };
  aliases: { vi: string[]; en: string[] };
  kind: 'strength' | 'cardio';
  equipment: Equipment[];
  pattern: MovementPattern;
  primary: MuscleId[];
  secondary: MuscleId[];
  load: {
    mode: LoadMode;
    /** Number of load-bearing implements the entered kg describes (2 = kg per dumbbell / per cable stack). */
    implements: 1 | 2;
    /** 2 when reps are logged per side. */
    sides: 1 | 2;
  };
  /** Cardio only: required and optional fields. */
  cardio?: { required: CardioField[]; optional: CardioField[] };
  animationId: string;
}

type Def = Omit<CatalogExercise, 'animationId' | 'load' | 'kind'> & {
  load: CatalogExercise['load'] | LoadMode;
  kind?: CatalogExercise['kind'];
};

function ex(d: Def): CatalogExercise {
  const load = typeof d.load === 'string' ? { mode: d.load, implements: 1 as const, sides: 1 as const } : d.load;
  return { ...d, kind: d.kind ?? 'strength', load, animationId: d.id };
}

const DB2 = { mode: 'dumbbell', implements: 2, sides: 1 } as const;

export const EXERCISES: readonly CatalogExercise[] = [
  // Chest
  ex({ id: 'barbell_bench_press', name: { vi: 'Đẩy ngực ghế phẳng với thanh đòn', en: 'Barbell Bench Press' }, aliases: { vi: ['đẩy ngực thanh đòn', 'đẩy ngực ngang', 'bench'], en: ['bench press', 'flat bench', 'bb bench'] }, equipment: ['barbell', 'bench', 'rack'], pattern: 'horizontal_push', primary: ['chest'], secondary: ['front_delts', 'triceps'], load: 'barbell' }),
  ex({ id: 'incline_dumbbell_press', name: { vi: 'Đẩy ngực ghế dốc với tạ đơn', en: 'Incline Dumbbell Press' }, aliases: { vi: ['đẩy ngực dốc tạ đơn', 'đẩy ngực trên tạ đơn'], en: ['incline db press', 'incline dumbbell bench'] }, equipment: ['dumbbell', 'bench'], pattern: 'incline_push', primary: ['chest'], secondary: ['front_delts', 'triceps'], load: DB2 }),
  ex({ id: 'machine_chest_press', name: { vi: 'Đẩy ngực máy', en: 'Machine Chest Press' }, aliases: { vi: ['máy đẩy ngực'], en: ['chest press machine', 'seated chest press'] }, equipment: ['machine'], pattern: 'horizontal_push', primary: ['chest'], secondary: ['front_delts', 'triceps'], load: 'machine' }),
  ex({ id: 'seated_cable_fly', name: { vi: 'Ép ngực cáp ngồi', en: 'Seated Cable Fly' }, aliases: { vi: ['ép ngực cáp', 'bay ngực cáp'], en: ['cable fly', 'cable chest fly'] }, equipment: ['cable', 'bench'], pattern: 'chest_fly', primary: ['chest'], secondary: ['front_delts'], load: { mode: 'cable', implements: 2, sides: 1 } }),
  ex({ id: 'parallel_bar_dip', name: { vi: 'Nhún xà kép', en: 'Parallel Bar Dip' }, aliases: { vi: ['dip', 'nhún xà'], en: ['dips', 'chest dip'] }, equipment: ['dip_bars', 'bodyweight'], pattern: 'vertical_push', primary: ['chest'], secondary: ['triceps', 'front_delts'], load: 'bodyweight' }),
  ex({ id: 'push_up', name: { vi: 'Hít đất', en: 'Push-up' }, aliases: { vi: ['chống đẩy'], en: ['pushup', 'press-up'] }, equipment: ['bodyweight'], pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps', 'front_delts', 'abs'], load: 'bodyweight' }),
  // Back
  ex({ id: 'wide_grip_lat_pulldown', name: { vi: 'Kéo xô rộng tay', en: 'Wide-Grip Lat Pulldown' }, aliases: { vi: ['kéo xô', 'kéo cáp xô'], en: ['lat pulldown', 'pulldown'] }, equipment: ['cable', 'machine'], pattern: 'vertical_pull', primary: ['lats'], secondary: ['upper_back', 'biceps', 'rear_delts'], load: 'machine' }),
  ex({ id: 'pull_up', name: { vi: 'Hít xà đơn', en: 'Pull-up' }, aliases: { vi: ['kéo xà', 'hít xà'], en: ['pullup', 'chin-up bar pull-up'] }, equipment: ['pullup_bar', 'bodyweight'], pattern: 'vertical_pull', primary: ['lats'], secondary: ['upper_back', 'biceps', 'forearms'], load: 'bodyweight' }),
  ex({ id: 'chest_supported_dumbbell_row', name: { vi: 'Chèo tạ đơn tựa ngực ghế dốc', en: 'Chest-Supported Dumbbell Row' }, aliases: { vi: ['chèo tạ đơn tựa ghế'], en: ['chest supported row', 'incline db row'] }, equipment: ['dumbbell', 'bench'], pattern: 'horizontal_pull', primary: ['upper_back', 'lats'], secondary: ['rear_delts', 'biceps'], load: DB2 }),
  ex({ id: 'seated_cable_row', name: { vi: 'Kéo cáp ngồi', en: 'Seated Cable Row' }, aliases: { vi: ['chèo cáp ngồi', 'kéo cáp ngang'], en: ['cable row', 'seated row'] }, equipment: ['cable'], pattern: 'horizontal_pull', primary: ['upper_back', 'lats'], secondary: ['rear_delts', 'biceps'], load: 'cable' }),
  ex({ id: 'barbell_bent_over_row', name: { vi: 'Chèo thanh đòn cúi người', en: 'Barbell Bent-Over Row' }, aliases: { vi: ['chèo thanh đòn', 'gập người kéo thanh đòn'], en: ['barbell row', 'bent over row'] }, equipment: ['barbell'], pattern: 'horizontal_pull', primary: ['upper_back', 'lats'], secondary: ['rear_delts', 'biceps', 'lower_back'], load: 'barbell' }),
  ex({ id: 'one_arm_dumbbell_row', name: { vi: 'Chèo tạ đơn một tay', en: 'One-Arm Dumbbell Row' }, aliases: { vi: ['chèo tạ đơn'], en: ['single arm db row', 'dumbbell row'] }, equipment: ['dumbbell', 'bench'], pattern: 'horizontal_pull', primary: ['lats', 'upper_back'], secondary: ['rear_delts', 'biceps'], load: { mode: 'dumbbell', implements: 1, sides: 2 } }),
  ex({ id: 'straight_arm_cable_pulldown', name: { vi: 'Kéo cáp tay thẳng', en: 'Straight-Arm Cable Pulldown' }, aliases: { vi: ['kéo xô tay thẳng'], en: ['straight arm pulldown', 'lat prayer'] }, equipment: ['cable'], pattern: 'shoulder_extension', primary: ['lats'], secondary: ['triceps', 'rear_delts'], load: 'cable' }),
  // Shoulders
  ex({ id: 'seated_dumbbell_shoulder_press', name: { vi: 'Đẩy vai tạ đơn ngồi', en: 'Seated Dumbbell Shoulder Press' }, aliases: { vi: ['đẩy vai tạ đơn'], en: ['db shoulder press', 'dumbbell overhead press'] }, equipment: ['dumbbell', 'bench'], pattern: 'vertical_push', primary: ['front_delts'], secondary: ['side_delts', 'triceps'], load: DB2 }),
  ex({ id: 'dumbbell_lateral_raise', name: { vi: 'Dang tạ đơn sang ngang', en: 'Dumbbell Lateral Raise' }, aliases: { vi: ['dang vai', 'nâng tạ sang ngang'], en: ['lateral raise', 'side raise'] }, equipment: ['dumbbell'], pattern: 'shoulder_abduction', primary: ['side_delts'], secondary: ['upper_traps'], load: DB2 }),
  ex({ id: 'single_arm_cable_lateral_raise', name: { vi: 'Dang cáp một tay', en: 'Single-Arm Cable Lateral Raise' }, aliases: { vi: ['dang vai cáp'], en: ['cable lateral raise', 'cable side raise'] }, equipment: ['cable'], pattern: 'shoulder_abduction', primary: ['side_delts'], secondary: ['upper_traps'], load: { mode: 'cable', implements: 1, sides: 2 } }),
  ex({ id: 'reverse_pec_deck', name: { vi: 'Bay ngược máy', en: 'Reverse Pec Deck' }, aliases: { vi: ['vai sau máy', 'bay vai sau'], en: ['rear delt fly machine', 'reverse fly'] }, equipment: ['machine'], pattern: 'rear_delt_fly', primary: ['rear_delts'], secondary: ['upper_back'], load: 'machine' }),
  ex({ id: 'cable_face_pull', name: { vi: 'Kéo cáp về mặt', en: 'Cable Face Pull' }, aliases: { vi: ['face pull'], en: ['face pull', 'rope face pull'] }, equipment: ['cable'], pattern: 'rear_delt_fly', primary: ['rear_delts'], secondary: ['upper_back', 'upper_traps'], load: 'cable' }),
  // Biceps
  ex({ id: 'dumbbell_preacher_curl', name: { vi: 'Cuốn tạ đơn ghế preacher', en: 'Dumbbell Preacher Curl' }, aliases: { vi: ['cuốn tạ ghế preacher', 'preacher curl'], en: ['preacher curl', 'db preacher curl'] }, equipment: ['dumbbell', 'bench'], pattern: 'elbow_flexion', primary: ['biceps'], secondary: ['brachialis'], load: { mode: 'dumbbell', implements: 1, sides: 2 } }),
  ex({ id: 'incline_dumbbell_curl', name: { vi: 'Cuốn tạ đơn ghế dốc', en: 'Incline Dumbbell Curl' }, aliases: { vi: ['cuốn tạ ghế dốc'], en: ['incline curl'] }, equipment: ['dumbbell', 'bench'], pattern: 'elbow_flexion', primary: ['biceps'], secondary: ['brachialis', 'forearms'], load: DB2 }),
  ex({ id: 'hammer_curl', name: { vi: 'Cuốn búa', en: 'Hammer Curl' }, aliases: { vi: ['cuốn tạ búa'], en: ['dumbbell hammer curl'] }, equipment: ['dumbbell'], pattern: 'elbow_flexion', primary: ['brachialis', 'forearms'], secondary: ['biceps'], load: DB2 }),
  ex({ id: 'barbell_curl', name: { vi: 'Cuốn thanh đòn', en: 'Barbell Curl' }, aliases: { vi: ['cuốn tay trước thanh đòn'], en: ['bb curl', 'standing barbell curl'] }, equipment: ['barbell'], pattern: 'elbow_flexion', primary: ['biceps'], secondary: ['brachialis', 'forearms'], load: 'barbell' }),
  // Triceps
  ex({ id: 'overhead_cable_triceps_extension', name: { vi: 'Duỗi tay sau qua đầu với cáp', en: 'Overhead Cable Triceps Extension' }, aliases: { vi: ['duỗi tay sau qua đầu'], en: ['overhead cable extension', 'cable overhead triceps'] }, equipment: ['cable'], pattern: 'elbow_extension', primary: ['triceps'], secondary: [], load: 'cable' }),
  ex({ id: 'cable_triceps_pushdown', name: { vi: 'Đè cáp tay sau', en: 'Cable Triceps Pushdown' }, aliases: { vi: ['đè cáp', 'kéo cáp tay sau'], en: ['pushdown', 'triceps pressdown'] }, equipment: ['cable'], pattern: 'elbow_extension', primary: ['triceps'], secondary: [], load: 'cable' }),
  ex({ id: 'ez_bar_skull_crusher', name: { vi: 'Skull crusher thanh EZ', en: 'EZ-Bar Skull Crusher' }, aliases: { vi: ['nằm duỗi tay sau'], en: ['skull crusher', 'lying triceps extension'] }, equipment: ['barbell', 'bench'], pattern: 'elbow_extension', primary: ['triceps'], secondary: [], load: 'barbell' }),
  // Quads & glutes
  ex({ id: 'barbell_back_squat', name: { vi: 'Squat thanh đòn sau lưng', en: 'Barbell Back Squat' }, aliases: { vi: ['squat', 'gánh đùi'], en: ['back squat', 'squat'] }, equipment: ['barbell', 'rack'], pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['adductors', 'lower_back'], load: 'barbell' }),
  ex({ id: 'hack_squat', name: { vi: 'Hack squat máy', en: 'Hack Squat' }, aliases: { vi: ['hack squat'], en: ['machine hack squat'] }, equipment: ['machine'], pattern: 'squat', primary: ['quads'], secondary: ['glutes', 'adductors'], load: 'machine' }),
  ex({ id: 'leg_press', name: { vi: 'Đạp đùi máy', en: 'Leg Press' }, aliases: { vi: ['đạp đùi'], en: ['45 degree leg press'] }, equipment: ['machine'], pattern: 'squat', primary: ['quads'], secondary: ['glutes', 'adductors'], load: 'machine' }),
  ex({ id: 'bulgarian_split_squat', name: { vi: 'Bulgarian split squat với tạ đơn', en: 'Dumbbell Bulgarian Split Squat' }, aliases: { vi: ['bulgarian', 'squat tách chân'], en: ['bss', 'rear foot elevated split squat'] }, equipment: ['dumbbell', 'bench'], pattern: 'lunge', primary: ['quads', 'glutes'], secondary: ['adductors'], load: { mode: 'dumbbell', implements: 2, sides: 2 } }),
  ex({ id: 'leg_extension', name: { vi: 'Đá đùi máy', en: 'Leg Extension' }, aliases: { vi: ['đá đùi'], en: ['knee extension machine'] }, equipment: ['machine'], pattern: 'knee_extension', primary: ['quads'], secondary: [], load: 'machine' }),
  // Hamstrings & glutes
  ex({ id: 'barbell_romanian_deadlift', name: { vi: 'Romanian deadlift thanh đòn', en: 'Barbell Romanian Deadlift' }, aliases: { vi: ['rdl', 'deadlift chân thẳng'], en: ['rdl', 'romanian deadlift'] }, equipment: ['barbell'], pattern: 'hip_hinge', primary: ['hamstrings', 'glutes'], secondary: ['lower_back', 'adductors', 'forearms'], load: 'barbell' }),
  ex({ id: 'seated_leg_curl', name: { vi: 'Cuốn đùi sau ngồi', en: 'Seated Leg Curl' }, aliases: { vi: ['cuốn đùi sau'], en: ['seated hamstring curl'] }, equipment: ['machine'], pattern: 'knee_flexion', primary: ['hamstrings'], secondary: [], load: 'machine' }),
  ex({ id: 'barbell_hip_thrust', name: { vi: 'Hip thrust thanh đòn', en: 'Barbell Hip Thrust' }, aliases: { vi: ['đẩy hông', 'hip thrust'], en: ['hip thrust'] }, equipment: ['barbell', 'bench'], pattern: 'hip_extension', primary: ['glutes'], secondary: ['hamstrings'], load: 'barbell' }),
  ex({ id: 'machine_hip_abduction', name: { vi: 'Dang hông máy', en: 'Machine Hip Abduction' }, aliases: { vi: ['dạng đùi máy', 'mở hông máy'], en: ['hip abductor machine', 'abduction'] }, equipment: ['machine'], pattern: 'hip_abduction', primary: ['glute_med'], secondary: ['glutes'], load: 'machine' }),
  // Calves
  ex({ id: 'standing_calf_raise', name: { vi: 'Nhón bắp chân đứng', en: 'Standing Calf Raise' }, aliases: { vi: ['nhón bắp chân'], en: ['calf raise', 'standing calf machine'] }, equipment: ['machine'], pattern: 'plantar_flexion', primary: ['gastrocnemius'], secondary: ['soleus'], load: 'machine' }),
  ex({ id: 'seated_calf_raise', name: { vi: 'Nhón bắp chân ngồi', en: 'Seated Calf Raise' }, aliases: { vi: ['nhón bắp chân ngồi'], en: ['seated calf'] }, equipment: ['machine'], pattern: 'plantar_flexion', primary: ['soleus'], secondary: ['gastrocnemius'], load: 'machine' }),
  // Core
  ex({ id: 'cable_crunch', name: { vi: 'Gập bụng với cáp', en: 'Kneeling Cable Crunch' }, aliases: { vi: ['gập bụng cáp'], en: ['cable crunch', 'rope crunch'] }, equipment: ['cable'], pattern: 'spinal_flexion', primary: ['abs'], secondary: ['obliques'], load: 'cable' }),
  ex({ id: 'hanging_leg_raise', name: { vi: 'Treo xà nâng chân', en: 'Hanging Leg Raise' }, aliases: { vi: ['nâng chân treo xà'], en: ['hanging knee raise', 'leg raise'] }, equipment: ['pullup_bar', 'bodyweight'], pattern: 'hip_flexion', primary: ['abs'], secondary: ['obliques'], load: 'bodyweight' }),
  // Cardio
  ex({ id: 'treadmill_walk_run', kind: 'cardio', name: { vi: 'Đi bộ/chạy máy', en: 'Treadmill Walk/Run' }, aliases: { vi: ['máy chạy bộ', 'đi bộ dốc'], en: ['treadmill', 'incline walk'] }, equipment: ['treadmill'], pattern: 'cardio_gait', primary: [], secondary: [], load: 'cardio', cardio: { required: ['duration_s'], optional: ['distance_km', 'speed_kmh', 'incline_pct'] } }),
  ex({ id: 'stationary_bike', kind: 'cardio', name: { vi: 'Đạp xe tại chỗ', en: 'Stationary Bike' }, aliases: { vi: ['xe đạp tập'], en: ['exercise bike', 'bike'] }, equipment: ['stationary_bike'], pattern: 'cardio_cycle', primary: [], secondary: [], load: 'cardio', cardio: { required: ['duration_s'], optional: ['distance_km', 'speed_kmh'] } }),
];

export const EXERCISE_BY_ID: ReadonlyMap<string, CatalogExercise> = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): CatalogExercise | undefined {
  return EXERCISE_BY_ID.get(id);
}
