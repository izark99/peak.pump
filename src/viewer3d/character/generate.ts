import { MUSCLE_IDS, muscleIndex } from '@shared/catalog/muscles';
import { polygonize, type MeshResult } from '../sdf/mesher';
import { evalField, primDistance, type Prim, type Region, type Vec3 } from '../sdf/primitives';
import { BONES, handPrims, headPrims, isHair } from './anatomy';
import { bodyBoneProxies, bodyShape, muscleLabels, shoePrims, shortsShape, type BoneProxy, type MuscleLabel } from './body';

/**
 * Generates the character's skinned mesh data (pure data, transferable from a Worker).
 */

export const GENERATOR_VERSION = 2;

export const REGION_CODES: Record<Region, number> = {
  skin: 0,
  shorts: 1,
  shoe: 2,
  sole: 3,
  lip: 4,
  nail: 5,
  hair: 6,
};

export type PartMaterial = 'skin' | 'cloth' | 'shoe' | 'hair';

export interface PartData {
  name: string;
  material: PartMaterial;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  skinIndex: Uint16Array;
  skinWeight: Float32Array;
  /** Two strongest muscles per vertex: index+1 (0 = none) and strength 0..1. */
  muscleA: Uint8Array;
  muscleAW: Float32Array;
  muscleB: Uint8Array;
  muscleBW: Float32Array;
  region: Uint8Array;
  /** Baked ambient occlusion from the SDF (bind pose), 0..1. */
  ao: Float32Array;
}

export interface CharacterData {
  version: number;
  parts: PartData[];
  stats: { vertices: number; triangles: number; ms: number };
}

export interface CharacterQuality {
  bodyCell: number;
  headCell: number;
  handCell: number;
}

export const QUALITY_PRESETS: Record<'low' | 'medium' | 'high', CharacterQuality> = {
  low: { bodyCell: 0.013, headCell: 0.005, handCell: 0.0042 },
  medium: { bodyCell: 0.0095, headCell: 0.0038, handCell: 0.0031 },
  high: { bodyCell: 0.0075, headCell: 0.003, handCell: 0.0025 },
};

function boundsOf(prims: readonly Prim[], pad: number): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of prims) {
    if (p.op !== 'add') continue;
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, p.bc[i]! - p.br - pad);
      max[i] = Math.max(max[i]!, p.bc[i]! + p.br + pad);
    }
  }
  return { min, max };
}

const AO_STEPS = [0.006, 0.013, 0.026, 0.045];

interface PartSpec {
  name: string;
  material: PartMaterial;
  prims: Prim[];
  post?: (d: number, x: number, y: number, z: number) => number;
  cell: number;
  /** 'prims': weights from owning primitives (hands, head); 'proxies': from bone segments. */
  weights: { mode: 'prims'; tau: number } | { mode: 'proxies'; proxies: BoneProxy[]; tau: number };
  smoothIterations: number;
  labels?: MuscleLabel[];
  defaultRegion?: Region;
  hair?: boolean;
  aoStrength: number;
  occluders: Prim[];
}

function segDist(a: Vec3, b: Vec3, x: number, y: number, z: number): number {
  const bx = b[0] - a[0];
  const by = b[1] - a[1];
  const bz = b[2] - a[2];
  const l2 = bx * bx + by * by + bz * bz;
  const t = l2 > 0 ? Math.min(1, Math.max(0, ((x - a[0]) * bx + (y - a[1]) * by + (z - a[2]) * bz) / l2)) : 0;
  return Math.hypot(a[0] + bx * t - x, a[1] + by * t - y, a[2] + bz * t - z);
}

function buildAdjacency(vcount: number, indices: Uint32Array): { offs: Int32Array; nbrs: Int32Array } {
  const sets: Set<number>[] = Array.from({ length: vcount }, () => new Set<number>());
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i]!;
    const b = indices[i + 1]!;
    const c = indices[i + 2]!;
    sets[a]!.add(b).add(c);
    sets[b]!.add(a).add(c);
    sets[c]!.add(a).add(b);
  }
  const offs = new Int32Array(vcount + 1);
  for (let v = 0; v < vcount; v++) offs[v + 1] = offs[v]! + sets[v]!.size;
  const nbrs = new Int32Array(offs[vcount]!);
  for (let v = 0; v < vcount; v++) {
    let k = offs[v]!;
    for (const n of sets[v]!) nbrs[k++] = n;
  }
  return { offs, nbrs };
}

function computeAttributes(spec: PartSpec, mesh: MeshResult): PartData {
  const prims = spec.prims;
  const V = mesh.positions.length / 3;
  const B = BONES.length;
  const M = MUSCLE_IDS.length;
  const dense = new Float32Array(V * B);
  const muscleA = new Uint8Array(V);
  const muscleAW = new Float32Array(V);
  const muscleB = new Uint8Array(V);
  const muscleBW = new Float32Array(V);
  const region = new Uint8Array(V);
  const ao = new Float32Array(V);
  const occ = spec.occluders;
  const occIdx = Int32Array.from(occ.map((_, i) => i));
  const mdist = new Float64Array(M);
  const labelMuscle = spec.labels?.map((l) => muscleIndex(l.muscle)) ?? [];

  for (let v = 0; v < V; v++) {
    const x = mesh.positions[v * 3]!;
    const y = mesh.positions[v * 3 + 1]!;
    const z = mesh.positions[v * 3 + 2]!;
    const cand = mesh.candidates[mesh.vertexCand[v]!]!;

    // ---- region: nearest primitive with an explicit region (shoes, lips, nails)
    let dmin = Infinity;
    let regionOf: Region = spec.defaultRegion ?? 'skin';
    const ds = new Float64Array(cand.length);
    mdist.fill(Infinity);
    for (let c = 0; c < cand.length; c++) {
      const p = prims[cand[c]!]!;
      if (p.op !== 'add') continue;
      const d = primDistance(p, x, y, z);
      ds[c] = d;
      if (d < dmin) {
        dmin = d;
        if (p.region !== 'skin') regionOf = p.region;
        else regionOf = spec.defaultRegion ?? 'skin';
      }
      if (!spec.labels && p.muscle >= 0 && d < mdist[p.muscle]!) mdist[p.muscle] = d;
    }

    // ---- skin weights
    const w = spec.weights;
    if (w.mode === 'proxies') {
      let emin = Infinity;
      const es = w.proxies.map((pr) => {
        const e = segDist(pr.a, pr.b, x, y, z) - pr.r;
        if (e < emin) emin = e;
        return e;
      });
      let sum = 0;
      w.proxies.forEach((pr, i) => {
        const ww = Math.exp(-(es[i]! - emin) / w.tau);
        dense[v * B + pr.bone] = dense[v * B + pr.bone]! + ww;
        sum += ww;
      });
      for (let b = 0; b < B; b++) dense[v * B + b] = dense[v * B + b]! / sum;
    } else {
      let wsum = 0;
      for (let c = 0; c < cand.length; c++) {
        const p = prims[cand[c]!]!;
        if (p.op !== 'add' || p.bone < 0) continue;
        const ww = Math.exp(-Math.max(0, ds[c]! - dmin) / w.tau);
        dense[v * B + p.bone] = dense[v * B + p.bone]! + ww;
        wsum += ww;
      }
      if (wsum > 0) for (let b = 0; b < B; b++) dense[v * B + b] = dense[v * B + b]! / wsum;
    }

    // ---- muscles (labels are separate volumes; geometry is never affected)
    let aI = -1;
    let aW = 0;
    let bI = -1;
    let bW = 0;
    const consider = (mm: number, s: number) => {
      if (s > aW) {
        if (aI !== mm) {
          bI = aI;
          bW = aW;
        }
        aI = mm;
        aW = s;
      } else if (s > bW && mm !== aI) {
        bI = mm;
        bW = s;
      }
    };
    if (spec.labels) {
      spec.labels.forEach((l, i) => {
        const d = primDistance(l.prim, x, y, z);
        const s = Math.max(0, Math.min(1, 1 - Math.max(0, d) / 0.014));
        if (s > 0) consider(labelMuscle[i]!, s);
      });
    } else {
      let best = Infinity;
      for (let mm = 0; mm < M; mm++) best = Math.min(best, mdist[mm]!);
      for (let mm = 0; mm < M; mm++) {
        const d = mdist[mm]!;
        if (!Number.isFinite(d)) continue;
        const depth = Math.max(0, d - dmin);
        consider(mm, Math.pow(Math.max(0, 1 - depth / 0.03), 1.5) * Math.exp(-(d - best) / 0.008));
      }
    }
    muscleA[v] = aI + 1;
    muscleAW[v] = aW;
    muscleB[v] = bI + 1;
    muscleBW[v] = bW;

    let rc = REGION_CODES[regionOf];
    if (spec.hair && rc === 0 && isHair(x, y, z)) rc = REGION_CODES.hair;
    region[v] = rc;

    // ---- SDF ambient occlusion along the normal (against all occluders)
    if (spec.aoStrength > 0) {
      const nx = mesh.normals[v * 3]!;
      const ny = mesh.normals[v * 3 + 1]!;
      const nz = mesh.normals[v * 3 + 2]!;
      let o = 0;
      let wgt = 1;
      for (const dlt of AO_STEPS) {
        const f = evalField(occ, occIdx, x + nx * dlt, y + ny * dlt, z + nz * dlt);
        o += (wgt * Math.max(0, dlt - f)) / dlt;
        wgt *= 0.5;
      }
      ao[v] = Math.max(0.6, Math.min(1, 1 - o * spec.aoStrength));
    } else ao[v] = 1;
  }

  if (spec.smoothIterations > 0) {
    const { offs, nbrs } = buildAdjacency(V, mesh.indices);
    let src = dense;
    let dst = new Float32Array(V * B);
    for (let it = 0; it < spec.smoothIterations; it++) {
      for (let v = 0; v < V; v++) {
        const n0 = offs[v]!;
        const n1 = offs[v + 1]!;
        const cnt = n1 - n0;
        for (let b = 0; b < B; b++) {
          let acc = 0;
          for (let k = n0; k < n1; k++) acc += src[nbrs[k]! * B + b]!;
          dst[v * B + b] = cnt > 0 ? 0.5 * src[v * B + b]! + (0.5 * acc) / cnt : src[v * B + b]!;
        }
      }
      const t = src;
      src = dst;
      dst = t;
    }
    dense.set(src);
  }

  const skinIndex = new Uint16Array(V * 4);
  const skinWeight = new Float32Array(V * 4);
  for (let v = 0; v < V; v++) {
    const top: [number, number][] = [];
    for (let b = 0; b < B; b++) {
      const ww = dense[v * B + b]!;
      if (ww > 1e-4) top.push([b, ww]);
    }
    top.sort((p, q) => q[1] - p[1]);
    let s = 0;
    for (let i = 0; i < 4 && i < top.length; i++) s += top[i]![1];
    for (let i = 0; i < 4; i++) {
      const e = top[i];
      skinIndex[v * 4 + i] = e ? e[0] : 0;
      skinWeight[v * 4 + i] = e && s > 0 ? e[1] / s : 0;
    }
    if (s === 0) skinWeight[v * 4] = 1;
  }

  return {
    name: spec.name,
    material: spec.material,
    positions: mesh.positions,
    normals: mesh.normals,
    indices: mesh.indices,
    skinIndex,
    skinWeight,
    muscleA,
    muscleAW,
    muscleB,
    muscleBW,
    region,
    ao,
  };
}

export function part(spec: PartSpec): PartData {
  const b = boundsOf(spec.prims, 2 * spec.cell + 0.03);
  const mesh = polygonize(spec.prims, { min: b.min, max: b.max, h: spec.cell, post: spec.post });
  return computeAttributes(spec, mesh);
}

export function characterParts(q: CharacterQuality): PartSpec[] {
  const body = bodyShape();
  const proxies = bodyBoneProxies();
  const head = headPrims();
  const shorts = shortsShape();
  const occluders = [...bodyShape({ relief: false })];
  return [
    { name: 'body', material: 'skin', prims: body, cell: q.bodyCell, weights: { mode: 'proxies', proxies, tau: 0.018 }, smoothIterations: 4, labels: muscleLabels(), aoStrength: 0.35, occluders: body },
    { name: 'head', material: 'skin', prims: head, cell: q.headCell, weights: { mode: 'prims', tau: 0.01 }, smoothIterations: 2, hair: true, aoStrength: 0.35, occluders: head },
    { name: 'hand_L', material: 'skin', prims: handPrims('L'), cell: q.handCell, weights: { mode: 'prims', tau: 0.003 }, smoothIterations: 2, aoStrength: 0.3, occluders: handPrims('L') },
    { name: 'hand_R', material: 'skin', prims: handPrims('R'), cell: q.handCell, weights: { mode: 'prims', tau: 0.003 }, smoothIterations: 2, aoStrength: 0.3, occluders: handPrims('R') },
    { name: 'shorts', material: 'cloth', prims: shorts.prims, post: shorts.post, cell: q.bodyCell * 0.8, weights: { mode: 'proxies', proxies, tau: 0.018 }, smoothIterations: 6, defaultRegion: 'shorts', aoStrength: 0.25, occluders: shorts.prims.filter((p) => p.op === 'add') },
    { name: 'shoe_L', material: 'shoe', prims: shoePrims('L'), cell: q.handCell * 1.6, weights: { mode: 'proxies', proxies, tau: 0.012 }, smoothIterations: 2, defaultRegion: 'shoe', aoStrength: 0.2, occluders: shoePrims('L') },
    { name: 'shoe_R', material: 'shoe', prims: shoePrims('R'), cell: q.handCell * 1.6, weights: { mode: 'proxies', proxies, tau: 0.012 }, smoothIterations: 2, defaultRegion: 'shoe', aoStrength: 0.2, occluders: shoePrims('R') },
  ].map((p) => ({ ...p, occluders: p.occluders.length ? p.occluders : occluders })) as PartSpec[];
}

export function generateCharacter(q: CharacterQuality): CharacterData {
  const t0 = performance.now();
  const parts = characterParts(q).map(part);
  let vertices = 0;
  let triangles = 0;
  for (const p of parts) {
    vertices += p.positions.length / 3;
    triangles += p.indices.length / 3;
  }
  return { version: GENERATOR_VERSION, parts, stats: { vertices, triangles, ms: performance.now() - t0 } };
}
