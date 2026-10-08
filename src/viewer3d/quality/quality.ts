import { QUALITY_PRESETS, type CharacterQuality } from '../character/generate';

export type QualityTier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  tier: QualityTier;
  character: CharacterQuality;
  maxPixelRatio: number;
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
}

export function qualitySettings(tier: QualityTier): QualitySettings {
  switch (tier) {
    case 'low':
      return { tier, character: QUALITY_PRESETS.low, maxPixelRatio: 1, antialias: false, shadows: false, shadowMapSize: 512 };
    case 'medium':
      return { tier, character: QUALITY_PRESETS.medium, maxPixelRatio: 1.5, antialias: true, shadows: true, shadowMapSize: 1024 };
    case 'high':
      return { tier, character: QUALITY_PRESETS.high, maxPixelRatio: 2, antialias: true, shadows: true, shadowMapSize: 2048 };
  }
}

/** Conservative automatic tier: never picks "high" automatically. */
export function autoTier(nav: { hardwareConcurrency?: number; deviceMemory?: number } = globalThis.navigator ?? {}): QualityTier {
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  if (cores <= 4 || mem <= 3) return 'low';
  return 'medium';
}
