import { it } from 'vitest';
import { generateCharacter, QUALITY_PRESETS } from '../../src/viewer3d/character/generate';

it('measure', { timeout: 120000 }, () => {
  const c = generateCharacter(QUALITY_PRESETS.medium);
  const body = c.parts.find((p) => p.name === 'body')!; console.log('stats', JSON.stringify(c.stats), c.parts.map((p) => p.name + ':' + p.positions.length / 3).join(' '));
  const P = body.positions;
  const slice = (y: number, xmax: number) => {
    let mx = 0, minz = 1, maxz = -1;
    for (let i = 0; i < P.length; i += 3) {
      if (Math.abs(P[i + 1]! - y) > 0.006 || Math.abs(P[i]!) > xmax) continue;
      mx = Math.max(mx, Math.abs(P[i]!)); minz = Math.min(minz, P[i + 2]!); maxz = Math.max(maxz, P[i + 2]!);
    }
    return `w=${(2 * mx).toFixed(3)} d=${(maxz - minz).toFixed(3)}`;
  };
  for (const [n, y, xm] of [['shoulder(deltoid)', 1.43, 0.35], ['chest', 1.33, 0.2], ['waist', 1.08, 0.3], ['hips', 0.93, 0.3], ['thigh', 0.75, 0.3], ['knee', 0.5, 0.3], ['calf', 0.38, 0.3], ['neck', 1.53, 0.1]] as const)
    console.log(n, y, slice(y, xm));
  // muscle prominence: how far abs/pec surfaces stand out from the core torso ellipsoid
});
