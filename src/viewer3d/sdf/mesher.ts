import { boundDistance, evalField, type Prim, type Vec3 } from './primitives';

/**
 * Narrow-band Surface Nets polygonizer for a set of SDF primitives.
 * 1. Coarse grid (4x cell size) evaluated everywhere to find cells near the surface.
 * 2. Fine grid evaluated only inside near cells, with a per-cell culled primitive list.
 * 3. One vertex per sign-changing fine cell, then projected onto the surface (Newton steps).
 */

export interface MeshResult {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  /** Per-vertex index into `candidates` (culled primitive list valid around that vertex). */
  vertexCand: Int32Array;
  candidates: Int32Array[];
}

export interface MeshOptions {
  min: Vec3;
  max: Vec3;
  /** Fine cell size (m). */
  h: number;
}

const C = 4; // fine cells per coarse cell

export function polygonize(prims: readonly Prim[], opts: MeshOptions): MeshResult {
  const { h } = opts;
  const min = opts.min;
  const ncx = Math.max(1, Math.ceil((opts.max[0] - min[0]) / (h * C)));
  const ncy = Math.max(1, Math.ceil((opts.max[1] - min[1]) / (h * C)));
  const ncz = Math.max(1, Math.ceil((opts.max[2] - min[2]) / (h * C)));
  const nx = ncx * C + 1;
  const ny = ncy * C + 1;
  const nz = ncz * C + 1;
  const H = h * C;

  const all = new Int32Array(prims.length);
  for (let i = 0; i < prims.length; i++) all[i] = i;

  // --- coarse samples
  const cxs = ncx + 1;
  const cys = ncy + 1;
  const czs = ncz + 1;
  const coarse = new Float32Array(cxs * cys * czs);
  for (let k = 0; k < czs; k++)
    for (let j = 0; j < cys; j++)
      for (let i = 0; i < cxs; i++) {
        coarse[i + cxs * (j + cys * k)] = evalField(prims, all, min[0] + i * H, min[1] + j * H, min[2] + k * H);
      }

  // --- near coarse cells + candidate lists
  const diag = H * Math.sqrt(3);
  const margin = diag * 1.5;
  const cellCand = new Int32Array(ncx * ncy * ncz).fill(-1);
  const candidates: Int32Array[] = [];
  const band = 2 * h;
  for (let k = 0; k < ncz; k++)
    for (let j = 0; j < ncy; j++)
      for (let i = 0; i < ncx; i++) {
        let near = false;
        for (let c = 0; c < 8 && !near; c++) {
          const v = coarse[i + (c & 1) + cxs * (j + ((c >> 1) & 1) + cys * (k + ((c >> 2) & 1)))]!;
          if (Math.abs(v) < margin) near = true;
        }
        if (!near) continue;
        const cx = min[0] + (i + 0.5) * H;
        const cy = min[1] + (j + 0.5) * H;
        const cz = min[2] + (k + 0.5) * H;
        const list: number[] = [];
        for (let p = 0; p < prims.length; p++) {
          const pr = prims[p]!;
          if (boundDistance(pr, cx, cy, cz) <= diag / 2 + pr.k + band) list.push(p);
        }
        if (list.length === 0) continue;
        cellCand[i + ncx * (j + ncy * k)] = candidates.length;
        candidates.push(Int32Array.from(list));
      }

  // --- fine samples (only within near cells)
  const fine = new Float32Array(nx * ny * nz).fill(Number.NaN);
  const fidx = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  for (let k = 0; k < ncz; k++)
    for (let j = 0; j < ncy; j++)
      for (let i = 0; i < ncx; i++) {
        const ci = cellCand[i + ncx * (j + ncy * k)]!;
        if (ci < 0) continue;
        const cand = candidates[ci]!;
        for (let kk = 0; kk <= C; kk++)
          for (let jj = 0; jj <= C; jj++)
            for (let ii = 0; ii <= C; ii++) {
              const fi = i * C + ii;
              const fj = j * C + jj;
              const fk = k * C + kk;
              const id = fidx(fi, fj, fk);
              if (!Number.isNaN(fine[id]!)) continue;
              fine[id] = evalField(prims, cand, min[0] + fi * h, min[1] + fj * h, min[2] + fk * h);
            }
      }

  // --- vertices
  const cellVert = new Map<number, number>();
  const pos: number[] = [];
  const vCand: number[] = [];
  const cornerVals = new Float64Array(8);
  const EDGES: [number, number][] = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const ci = cellCand[Math.floor(i / C) + ncx * (Math.floor(j / C) + ncy * Math.floor(k / C))]!;
        if (ci < 0) continue;
        let mask = 0;
        let valid = true;
        for (let c = 0; c < 8; c++) {
          const v = fine[fidx(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))]!;
          if (Number.isNaN(v)) {
            valid = false;
            break;
          }
          cornerVals[c] = v;
          if (v < 0) mask |= 1 << c;
        }
        if (!valid || mask === 0 || mask === 255) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let n = 0;
        for (const [a, b] of EDGES) {
          const va = cornerVals[a]!;
          const vb = cornerVals[b]!;
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          const ax = a & 1;
          const ay = (a >> 1) & 1;
          const az = (a >> 2) & 1;
          const bx = b & 1;
          const by = (b >> 1) & 1;
          const bz = (b >> 2) & 1;
          sx += ax + (bx - ax) * t;
          sy += ay + (by - ay) * t;
          sz += az + (bz - az) * t;
          n++;
        }
        cellVert.set(i + (nx - 1) * (j + (ny - 1) * k), pos.length / 3);
        pos.push(min[0] + (i + sx / n) * h, min[1] + (j + sy / n) * h, min[2] + (k + sz / n) * h);
        vCand.push(ci);
      }

  // --- faces
  const idx: number[] = [];
  const cv = (i: number, j: number, k: number) => cellVert.get(i + (nx - 1) * (j + (ny - 1) * k));
  const quad = (a?: number, b?: number, c?: number, d?: number, flip?: boolean) => {
    if (a === undefined || b === undefined || c === undefined || d === undefined) return;
    if (flip) idx.push(a, d, c, a, c, b);
    else idx.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const v0 = fine[fidx(i, j, k)]!;
        if (Number.isNaN(v0)) continue;
        const in0 = v0 < 0;
        // edge +x
        if (i < nx - 1) {
          const v1 = fine[fidx(i + 1, j, k)]!;
          if (!Number.isNaN(v1) && v1 < 0 !== in0) quad(cv(i, j - 1, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i, j - 1, k), !in0);
        }
        // edge +y
        if (j < ny - 1) {
          const v1 = fine[fidx(i, j + 1, k)]!;
          if (!Number.isNaN(v1) && v1 < 0 !== in0) quad(cv(i - 1, j, k - 1), cv(i - 1, j, k), cv(i, j, k), cv(i, j, k - 1), !in0);
        }
        // edge +z
        if (k < nz - 1) {
          const v1 = fine[fidx(i, j, k + 1)]!;
          if (!Number.isNaN(v1) && v1 < 0 !== in0) quad(cv(i - 1, j - 1, k), cv(i, j - 1, k), cv(i, j, k), cv(i - 1, j, k), !in0);
        }
      }

  // --- project onto surface + analytic normals
  const vcount = pos.length / 3;
  const positions = new Float32Array(pos);
  const normals = new Float32Array(vcount * 3);
  const e = h * 0.25;
  for (let v = 0; v < vcount; v++) {
    const cand = candidates[vCand[v]!]!;
    let x = positions[v * 3]!;
    let y = positions[v * 3 + 1]!;
    let z = positions[v * 3 + 2]!;
    let gx = 0;
    let gy = 0;
    let gz = 0;
    for (let it = 0; it < 3; it++) {
      const d = evalField(prims, cand, x, y, z);
      gx = evalField(prims, cand, x + e, y, z) - evalField(prims, cand, x - e, y, z);
      gy = evalField(prims, cand, x, y + e, z) - evalField(prims, cand, x, y - e, z);
      gz = evalField(prims, cand, x, y, z + e) - evalField(prims, cand, x, y, z - e);
      const gl = Math.hypot(gx, gy, gz) || 1;
      gx /= gl;
      gy /= gl;
      gz /= gl;
      if (it === 2) break;
      const step = Math.max(-h * 0.5, Math.min(h * 0.5, d));
      x -= gx * step;
      y -= gy * step;
      z -= gz * step;
    }
    positions[v * 3] = x;
    positions[v * 3 + 1] = y;
    positions[v * 3 + 2] = z;
    normals[v * 3] = gx;
    normals[v * 3 + 1] = gy;
    normals[v * 3 + 2] = gz;
  }

  return {
    positions,
    normals,
    indices: new Uint32Array(idx),
    vertexCand: Int32Array.from(vCand),
    candidates,
  };
}
