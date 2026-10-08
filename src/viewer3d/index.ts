/** Lazy entry point for the 3D viewer. Import with `await import('../viewer3d')` only where needed. */
export { ExerciseViewer, type ViewPreset, type Theme, type ViewerState } from './viewer/Viewer';
export { ANIMATIONS } from './exercises/registry';
export { autoTier, type QualityTier } from './quality/quality';
export { DEFAULT_PALETTE } from './character/build';
