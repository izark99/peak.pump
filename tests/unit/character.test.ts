import { describe, expect, it } from 'vitest';
import { generateCharacter, QUALITY_PRESETS } from '../../src/viewer3d/character/generate';

describe('character generator', () => {
  it('generates all parts with normalized skin weights', () => {
    const c = generateCharacter(QUALITY_PRESETS.medium);
    console.log('character stats', JSON.stringify(c.stats), c.parts.map((p) => `${p.name}:${p.positions.length / 3}`).join(' '));
    expect(c.parts.map((p) => p.name)).toEqual(['body', 'head', 'hand_L', 'hand_R']);
    for (const p of c.parts) {
      const V = p.positions.length / 3;
      expect(V).toBeGreaterThan(1000);
      for (let v = 0; v < V; v++) {
        const s = p.skinWeight[v * 4]! + p.skinWeight[v * 4 + 1]! + p.skinWeight[v * 4 + 2]! + p.skinWeight[v * 4 + 3]!;
        expect(Math.abs(s - 1)).toBeLessThan(1e-3);
      }
    }
  }, 120000);
});
