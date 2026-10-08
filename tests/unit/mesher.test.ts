import { describe, expect, it } from 'vitest';
import { polygonize } from '../../src/viewer3d/sdf/mesher';
import { sphere } from '../../src/viewer3d/sdf/primitives';

describe('surface nets mesher', () => {
  it('meshes a sphere with outward winding and accurate radius', () => {
    const prims = [sphere([0, 0, 0], 0.1, { bone: 0 })];
    const m = polygonize(prims, { min: [-0.15, -0.15, -0.15], max: [0.15, 0.15, 0.15], h: 0.01 });
    const V = m.positions.length / 3;
    expect(V).toBeGreaterThan(300);
    for (let v = 0; v < V; v++) {
      const r = Math.hypot(m.positions[v * 3]!, m.positions[v * 3 + 1]!, m.positions[v * 3 + 2]!);
      expect(Math.abs(r - 0.1)).toBeLessThan(0.001);
    }
    let outward = 0;
    const T = m.indices.length / 3;
    for (let t = 0; t < T; t++) {
      const [a, b, c] = [m.indices[t * 3]!, m.indices[t * 3 + 1]!, m.indices[t * 3 + 2]!];
      const p = (i: number) => [m.positions[i * 3]!, m.positions[i * 3 + 1]!, m.positions[i * 3 + 2]!] as const;
      const A = p(a), Bv = p(b), C = p(c);
      const u = [Bv[0] - A[0], Bv[1] - A[1], Bv[2] - A[2]];
      const w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const n = [u[1]! * w[2]! - u[2]! * w[1]!, u[2]! * w[0]! - u[0]! * w[2]!, u[0]! * w[1]! - u[1]! * w[0]!];
      if (n[0]! * A[0] + n[1]! * A[1] + n[2]! * A[2] > 0) outward++;
    }
    expect(outward / T).toBeGreaterThan(0.99);
  });
});
