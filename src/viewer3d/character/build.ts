import {
  Bone,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Material,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
} from 'three';
import { MUSCLE_IDS, type MuscleId } from '@shared/catalog/muscles';
import { BONES, EYE_RADIUS, eyeCenter, SIDES } from './anatomy';
import { REGION_CODES, type CharacterData, type PartData } from './generate';
import type { Rig } from '../rig/rig';

export type HighlightRole = 'primary' | 'secondary';

export interface HighlightPalette {
  primary: Color;
  secondary: Color;
  strength: number;
}

const srgb = (hex: number) => new Color().setHex(hex);

export const DEFAULT_PALETTE: HighlightPalette = {
  primary: srgb(0xe8412b),
  secondary: srgb(0x3d7bf0),
  strength: 0.78,
};

const REGION_COLORS: Record<number, Color> = {
  [REGION_CODES.skin]: srgb(0xc68e6c),
  [REGION_CODES.shorts]: srgb(0x23262c),
  [REGION_CODES.shoe]: srgb(0x2b2e34),
  [REGION_CODES.sole]: srgb(0xe9e7e2),
  [REGION_CODES.lip]: srgb(0xa9675c),
  [REGION_CODES.nail]: srgb(0xd9b3a3),
  [REGION_CODES.hair]: srgb(0x231a15),
};

export interface CharacterObject {
  root: Group;
  skeleton: Skeleton;
  bones: Bone[];
  meshes: SkinnedMesh[];
  setHighlight(map: Partial<Record<MuscleId, HighlightRole>>, enabled: boolean, palette?: HighlightPalette): void;
  applyRig(rig: Rig): void;
  dispose(): void;
}

export type MaterialMode = 'final' | 'clay';

const CLAY = srgb(0xb4b6b8);

export function buildCharacter(data: CharacterData, mode: MaterialMode = 'final'): CharacterObject {
  // skeleton (identity bind orientations, positions relative to parent)
  const bones: Bone[] = BONES.map((b) => {
    const bone = new Bone();
    bone.name = b.name;
    return bone;
  });
  const byName = new Map(bones.map((b) => [b.name, b]));
  BONES.forEach((def, i) => {
    const bone = bones[i]!;
    if (def.parent) {
      const p = BONES.find((x) => x.name === def.parent)!;
      bone.position.set(def.head[0] - p.head[0], def.head[1] - p.head[1], def.head[2] - p.head[2]);
      byName.get(def.parent)!.add(bone);
    } else {
      bone.position.set(def.head[0], def.head[1], def.head[2]);
    }
  });
  const root = new Group();
  root.name = 'character';
  root.add(bones[0]!);
  root.updateMatrixWorld(true);
  const skeleton = new Skeleton(bones);

  const materials: Record<string, Material> =
    mode === 'clay'
      ? { skin: new MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 }) }
      : {
          skin: new MeshPhysicalMaterial({
            vertexColors: true,
            roughness: 0.58,
            metalness: 0,
            sheen: 0.12,
            sheenRoughness: 0.8,
            sheenColor: new Color(0xffc9b0),
          }),
          cloth: new MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 }),
          shoe: new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 }),
          hair: new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
        };
  const matFor = (m: string) => materials[m] ?? materials.skin!;

  const parts: { mesh: SkinnedMesh; data: PartData; colors: Float32Array; ao: Float32Array }[] = [];
  for (const p of data.parts) {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(p.positions, 3));
    geo.setAttribute('normal', new BufferAttribute(p.normals, 3));
    geo.setAttribute('skinIndex', new BufferAttribute(p.skinIndex, 4));
    geo.setAttribute('skinWeight', new BufferAttribute(p.skinWeight, 4));
    const colors = new Float32Array(p.positions.length);
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    geo.setIndex(new BufferAttribute(p.indices, 1));
    const mesh = new SkinnedMesh(geo, matFor(p.material));
    mesh.name = p.name;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.bind(skeleton);
    root.add(mesh);
    parts.push({ mesh, data: p, colors, ao: p.ao });
  }

  // eyes: sclera + iris + pupil as vertex colours, glossy
  const eyeGeo = new SphereGeometry(EYE_RADIUS, 24, 16);
  const eyeColors = new Float32Array(eyeGeo.attributes.position!.count * 3);
  const pos = eyeGeo.attributes.position!;
  const sclera = srgb(0xe9e4dc);
  const iris = srgb(0x4a3322);
  const pupil = srgb(0x0b0908);
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i) / EYE_RADIUS;
    const c = z > 0.93 ? pupil : z > 0.8 ? iris : sclera;
    eyeColors.set([c.r, c.g, c.b], i * 3);
  }
  eyeGeo.setAttribute('color', new BufferAttribute(eyeColors, 3));
  if (mode === 'clay') eyeColors.fill(CLAY.r);
  const eyeMat = new MeshPhysicalMaterial({ vertexColors: true, roughness: mode === 'clay' ? 0.62 : 0.25, clearcoat: mode === 'clay' ? 0 : 1, clearcoatRoughness: 0.05 });
  const headBone = byName.get('head')!;
  const headHead = BONES.find((b) => b.name === 'head')!.head;
  for (const side of SIDES) {
    const e = new Mesh(eyeGeo, eyeMat);
    const c = eyeCenter(side);
    e.position.set(c[0] - headHead[0], c[1] - headHead[1], c[2] - headHead[2]);
    headBone.add(e);
  }

  let current: { map: Partial<Record<MuscleId, HighlightRole>>; enabled: boolean; palette: HighlightPalette } = {
    map: {},
    enabled: false,
    palette: DEFAULT_PALETTE,
  };

  const recolor = () => {
    const roles = new Int8Array(MUSCLE_IDS.length + 1);
    if (current.enabled) {
      MUSCLE_IDS.forEach((id, i) => {
        const r = current.map[id];
        roles[i + 1] = r === 'primary' ? 1 : r === 'secondary' ? 2 : 0;
      });
    }
    const { primary, secondary, strength } = current.palette;
    for (const { data: p, colors, ao, mesh } of parts) {
      const V = p.positions.length / 3;
      for (let v = 0; v < V; v++) {
        const base = mode === 'clay' ? CLAY : (REGION_COLORS[p.region[v]!] ?? REGION_COLORS[0]!);
        let r = base.r;
        let g = base.g;
        let b = base.b;
        let wp = 0;
        let ws = 0;
        const ra = roles[p.muscleA[v]!]!;
        const rb = roles[p.muscleB[v]!]!;
        if (ra === 1) wp = Math.max(wp, p.muscleAW[v]!);
        if (ra === 2) ws = Math.max(ws, p.muscleAW[v]!);
        if (rb === 1) wp = Math.max(wp, p.muscleBW[v]!);
        if (rb === 2) ws = Math.max(ws, p.muscleBW[v]!);
        if (wp >= ws && wp > 0) {
          const t = Math.min(1, wp) * strength;
          r += (primary.r - r) * t;
          g += (primary.g - g) * t;
          b += (primary.b - b) * t;
        } else if (ws > 0) {
          const t = Math.min(1, ws) * strength;
          r += (secondary.r - r) * t;
          g += (secondary.g - g) * t;
          b += (secondary.b - b) * t;
        }
        const o = mode === 'clay' ? 1 : ao[v]!;
        colors[v * 3] = r * o;
        colors[v * 3 + 1] = g * o;
        colors[v * 3 + 2] = b * o;
      }
      (mesh.geometry.attributes.color as BufferAttribute).needsUpdate = true;
    }
  };
  recolor();

  return {
    root,
    skeleton,
    bones,
    meshes: parts.map((p) => p.mesh),
    setHighlight(map, enabled, palette) {
      current = { map, enabled, palette: palette ?? current.palette };
      recolor();
    },
    applyRig(rig: Rig) {
      rig.bones.forEach((b, i) => {
        const bone = bones[i]!;
        bone.quaternion.copy(b.local);
        if (b.parent < 0) bone.position.copy(rig.rootPosition);
      });
      root.updateMatrixWorld(true);
    },
    dispose() {
      for (const p of parts) p.mesh.geometry.dispose();
      eyeGeo.dispose();
      eyeMat.dispose();
      for (const m of Object.values(materials)) m.dispose();
      skeleton.dispose();
    },
  };
}
