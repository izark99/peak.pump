import { MUSCLE_IDS } from '@shared/catalog/muscles';
import { polygonize, type MeshResult } from '../sdf/mesher';
import { evalField, primDistance, type Prim, type Region, type Vec3 } from '../sdf/primitives';
import { BONES, bodyPrims, handPrims, headPrims, isHair } from './anatomy';

/**
 * Generates the character's skinned mesh data (pure data, transferable from a Worker).
 */

export const GENERATOR_VERSION = 1;

export const REGION_CODES: Record<Region | 'hair', number> = {
  skin: 0,
  shorts: 1,
  shoe: 2,
  sole: 3,
  lip: 4,
  nail: 5,
  hair: 6,
};

export interface PartData {
  name: 'body' | 'head' | 'hand_L' | 'hand_R';
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
  low: { bodyCell: 0.014, headCell: 0.0055, handCell: 0.0042 },
  medium: { bodyCell: 0.0105, headCell: 0.0042, handCell: 0.0031 },
  high: { bodyCell: 0.0082, headCell: 0.0034, handCell: 0.0025 },
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

interface AttrOptions {
  aoStrength: number;
  tau: number;
  smoothIterations: number;
  hair?: boolean;
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

export function computeAttributes(name: PartData['name'], prims: readonly Prim[], mesh: MeshResult, opt: AttrOptions): PartData {
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
  const allPrims = Int32Array.from(prims.map((_, i) => i));
  const mdist = new Float64Array(M);

  for (let v = 0; v < V; v++) {
    const x = mesh.positions[v * 3]!;
    const y = mesh.positions[v * 3 + 1]!;
    const z = mesh.positions[v * 3 + 2]!;
    const cand = mesh.candidates[mesh.vertexCand[v]!]!;
    let dmin = Infinity;
    let regionPrim: Prim | undefined;
    const ds = new Float64Array(cand.length);
    mdist.fill(Infinity);
    for (let c = 0; c < cand.length; c++) {
      const p = prims[cand[c]!]!;
      if (p.op !== 'add') continue;
      const d = primDistance(p, x, y, z);
      ds[c] = d;
      if (d < dmin) {
        dmin = d;
        regionPrim = p;
      }
      if (p.muscle >= 0 && d < mdist[p.muscle]!) mdist[p.muscle] = d;
    }
    // skin weights from soft ownership of primitives
    let wsum = 0;
    for (let c = 0; c < cand.length; c++) {
      const p = prims[cand[c]!]!;
      if (p.op !== 'add' || p.bone < 0) continue;
      const w = Math.exp(-Math.max(0, ds[c]! - dmin) / opt.tau);
      dense[v * B + p.bone] = dense[v * B + p.bone]! + w;
      wsum += w;
    }
    if (wsum > 0) for (let b = 0; b < B; b++) dense[v * B + b] = dense[v * B + b]! / wsum;

    // muscles: strength fades with depth below the surface and with distance to the winner
    let best = Infinity;
    for (let mm = 0; mm < M; mm++) best = Math.min(best, mdist[mm]!);
    let aI = -1;
    let aW = 0;
    let bI = -1;
    let bW = 0;
    for (let mm = 0; mm < M; mm++) {
      const d = mdist[mm]!;
      if (!Number.isFinite(d)) continue;
      const depth = Math.max(0, d - dmin);
      const s = Math.pow(Math.max(0, 1 - depth / 0.03), 1.5) * Math.exp(-(d - best) / 0.008);
      if (s > aW) {
        bI = aI;
        bW = aW;
        aI = mm;
        aW = s;
      } else if (s > bW) {
        bI = mm;
        bW = s;
      }
    }
    muscleA[v] = aI + 1;
    muscleAW[v] = aW;
    muscleB[v] = bI + 1;
    muscleBW[v] = bW;

    let rc = REGION_CODES[regionPrim?.region ?? 'skin'];
    if (opt.hair && rc === 0 && isHair(x, y, z)) rc = REGION_CODES.hair;
    region[v] = rc;

    // SDF ambient occlusion: sample along the normal
    const nx = mesh.normals[v * 3]!;
    const ny = mesh.normals[v * 3 + 1]!;
    const nz = mesh.normals[v * 3 + 2]!;
    let occ = 0;
    let wgt = 1;
    for (const dlt of AO_STEPS) {
      const f = evalField(prims, allPrims, x + nx * dlt, y + ny * dlt, z + nz * dlt);
      occ += (wgt * Math.max(0, dlt - f)) / dlt;
      wgt *= 0.5;
    }
    ao[v] = Math.max(0.42, Math.min(1, 1 - occ * opt.aoStrength));
  }

  // Laplacian smoothing of skin weights across the surface (wider, smoother joint blends)
  if (opt.smoothIterations > 0) {
    const { offs, nbrs } = buildAdjacency(V, mesh.indices);
    let src = dense;
    let dst = new Float32Array(V * B);
    for (let it = 0; it < opt.smoothIterations; it++) {
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

  // top-4 bones
  const skinIndex = new Uint16Array(V * 4);
  const skinWeight = new Float32Array(V * 4);
  for (let v = 0; v < V; v++) {
    const top: [number, number][] = [];
    for (let b = 0; b < B; b++) {
      const w = dense[v * B + b]!;
      if (w <= 1e-4) continue;
      top.push([b, w]);
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
    name,
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

function part(name: PartData['name'], prims: Prim[], h: number, opt: AttrOptions): PartData {
  const b = boundsOf(prims, 2 * h);
  const mesh = polygonize(prims, { min: b.min, max: b.max, h });
  return computeAttributes(name, prims, mesh, opt);
}

export function generateCharacter(q: CharacterQuality): CharacterData {
  const t0 = performance.now();
  const parts: PartData[] = [
    part('body', bodyPrims(), q.bodyCell, { tau: 0.012, smoothIterations: 4, aoStrength: 0.55 }),
    part('head', headPrims(), q.headCell, { tau: 0.01, smoothIterations: 2, hair: true, aoStrength: 0.45 }),
    part('hand_L', handPrims('L'), q.handCell, { tau: 0.003, smoothIterations: 2, aoStrength: 0.35 }),
    part('hand_R', handPrims('R'), q.handCell, { tau: 0.003, smoothIterations: 2, aoStrength: 0.35 }),
  ];
  let vertices = 0;
  let triangles = 0;
  for (const p of parts) {
    vertices += p.positions.length / 3;
    triangles += p.indices.length / 3;
  }
  return { version: GENERATOR_VERSION, parts, stats: { vertices, triangles, ms: performance.now() - t0 } };
}
