import { it } from 'vitest';
import { characterParts, part, QUALITY_PRESETS } from '../../src/viewer3d/character/generate';
it('timing', { timeout: 120000 }, () => {
  for (const spec of characterParts(QUALITY_PRESETS.medium)) {
    const t0 = performance.now();
    const ao = spec.aoStrength;
    const p = part({ ...spec, aoStrength: 0 });
    const t1 = performance.now();
    part({ ...spec, aoStrength: ao });
    console.log('T', spec.name, Math.round(t1 - t0), 'ms noAO;', Math.round(performance.now() - t1), 'ms withAO', p.positions.length / 3);
  }
});
