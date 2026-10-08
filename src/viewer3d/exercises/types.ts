import type { Group, Vector3 } from 'three';
import type { Rig } from '../rig/rig';

export type PhaseName = 'concentric' | 'eccentric' | 'hold_top' | 'hold_bottom' | 'idle';

export interface PhaseSpec {
  name: PhaseName;
  /** Seconds at speed 1. */
  duration: number;
  /** Range-of-motion position at phase start/end (0 = start position, 1 = turnaround). */
  from: number;
  to: number;
}

export interface ContactReport {
  name: string;
  /** Distance (m) between the intended and achieved contact point. */
  error: number;
}

export interface EquipmentSet {
  group: Group;
  dispose(): void;
}

export interface ExerciseAnimation<E extends EquipmentSet = EquipmentSet> {
  id: string;
  phases: PhaseSpec[];
  camera: { target: [number, number, number]; distance: number; azimuth: number; elevation: number };
  createEquipment(): E;
  /** Pose the rig and equipment for ROM position `r` (0..1). Returns contact errors. */
  pose(r: number, rig: Rig, eq: E, time: number): ContactReport[];
}

export interface TimelineSample {
  phase: PhaseName;
  /** ROM position 0..1 */
  r: number;
}

export function cycleDuration(phases: readonly PhaseSpec[]): number {
  return phases.reduce((s, p) => s + p.duration, 0);
}

const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));

/** Sample the looping rep timeline at absolute time `t` (seconds). */
export function sampleTimeline(phases: readonly PhaseSpec[], t: number): TimelineSample {
  const total = cycleDuration(phases);
  let x = ((t % total) + total) % total;
  for (const p of phases) {
    if (x <= p.duration) {
      const k = p.duration > 0 ? ease(x / p.duration) : 1;
      return { phase: p.name, r: p.from + (p.to - p.from) * k };
    }
    x -= p.duration;
  }
  const last = phases[phases.length - 1]!;
  return { phase: last.name, r: last.to };
}

export type Vec = Vector3;
