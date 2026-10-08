import {
  BufferGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  TorusGeometry,
  Vector2,
  Vector3,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Procedural gym equipment building blocks. All geometry is generated in code.
 */

export interface EquipmentMaterials {
  steel: MeshStandardMaterial;
  chrome: MeshStandardMaterial;
  frame: MeshStandardMaterial;
  rubber: MeshStandardMaterial;
  pad: MeshStandardMaterial;
  plate: MeshStandardMaterial;
  accent: MeshStandardMaterial;
  cable: MeshStandardMaterial;
}

export function createMaterials(): EquipmentMaterials {
  return {
    steel: new MeshStandardMaterial({ color: 0xb9bdc3, metalness: 1, roughness: 0.32 }),
    chrome: new MeshStandardMaterial({ color: 0xd9dde2, metalness: 1, roughness: 0.15 }),
    frame: new MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.4, roughness: 0.45 }),
    rubber: new MeshStandardMaterial({ color: 0x17181b, metalness: 0, roughness: 0.85 }),
    pad: new MeshStandardMaterial({ color: 0x1e2024, metalness: 0, roughness: 0.62 }),
    plate: new MeshStandardMaterial({ color: 0x3b3f46, metalness: 0.6, roughness: 0.42 }),
    accent: new MeshStandardMaterial({ color: 0xd8432f, metalness: 0.2, roughness: 0.5 }),
    cable: new MeshStandardMaterial({ color: 0x111214, metalness: 0.3, roughness: 0.5 }),
  };
}

export function disposeObject(root: Object3D): void {
  const geos = new Set<BufferGeometry>();
  const mats = new Set<Material>();
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) {
      geos.add(m.geometry);
      const mm = m.material;
      (Array.isArray(mm) ? mm : [mm]).forEach((x) => mats.add(x));
    }
  });
  geos.forEach((g) => g.dispose());
  mats.forEach((m) => m.dispose());
}

export function mesh(geo: BufferGeometry, mat: Material, cast = true): Mesh {
  const m = new Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

const UP = new Vector3(0, 1, 0);

/** Cylinder from a to b. */
export function tube(a: Vector3, b: Vector3, r: number, mat: Material, segments = 16): Mesh {
  const d = b.clone().sub(a);
  const m = mesh(new CylinderGeometry(r, r, d.length(), segments), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}

/** Re-orient an existing unit-height cylinder mesh between two points (cables). */
export function placeBetween(m: Object3D, a: Vector3, b: Vector3): void {
  const d = b.clone().sub(a);
  const l = d.length();
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, l > 1e-6 ? d.multiplyScalar(1 / l) : UP);
  m.scale.set(1, Math.max(l, 1e-4), 1);
}

export function box(size: [number, number, number], mat: Material, radius = 0.01): Mesh {
  return mesh(new RoundedBoxGeometry(size[0], size[1], size[2], 3, Math.min(radius, Math.min(...size) / 2 - 1e-4)), mat);
}

/** Bumper/iron plate via lathe profile, axis along X. */
export function plateGeometry(radius: number, thickness: number, hub = 0.026): BufferGeometry {
  const t = thickness / 2;
  const rim = Math.min(0.02, radius * 0.12);
  const pts = [
    new Vector2(hub, -t * 0.7),
    new Vector2(hub + 0.02, -t * 0.7),
    new Vector2(hub + 0.025, -t * 0.45),
    new Vector2(radius - rim, -t * 0.45),
    new Vector2(radius - rim * 0.3, -t),
    new Vector2(radius, -t * 0.8),
    new Vector2(radius, t * 0.8),
    new Vector2(radius - rim * 0.3, t),
    new Vector2(radius - rim, t * 0.45),
    new Vector2(hub + 0.025, t * 0.45),
    new Vector2(hub + 0.02, t * 0.7),
    new Vector2(hub, t * 0.7),
  ];
  const g = new LatheGeometry(pts, 48);
  g.rotateZ(Math.PI / 2); // lathe axis Y -> X
  return g;
}

/** Hex dumbbell, handle along local X, origin at handle centre. */
export function dumbbell(m: EquipmentMaterials, headRadius = 0.058, headWidth = 0.075): Group {
  const g = new Group();
  g.name = 'dumbbell';
  const handleLen = 0.135;
  const handle = mesh(new CylinderGeometry(0.0165, 0.0165, handleLen + 0.02, 20), m.chrome);
  handle.rotation.z = Math.PI / 2;
  g.add(handle);
  for (const s of [-1, 1]) {
    const head = mesh(new CylinderGeometry(headRadius, headRadius, headWidth, 6), m.rubber);
    head.rotation.z = Math.PI / 2;
    head.position.x = s * (handleLen / 2 + headWidth / 2);
    g.add(head);
    const cap = mesh(new CylinderGeometry(0.03, 0.03, 0.004, 24), m.chrome);
    cap.rotation.z = Math.PI / 2;
    cap.position.x = s * (handleLen / 2 + headWidth + 0.002);
    g.add(cap);
  }
  return g;
}

/** Olympic barbell along local X with plates per side (radius, thickness). */
export function barbell(m: EquipmentMaterials, plates: [number, number][] = [[0.225, 0.055], [0.225, 0.055]]): Group {
  const g = new Group();
  g.name = 'barbell';
  const shaft = mesh(new CylinderGeometry(0.014, 0.014, 1.31, 20), m.steel);
  shaft.rotation.z = Math.PI / 2;
  g.add(shaft);
  for (const s of [-1, 1]) {
    const collar = mesh(new CylinderGeometry(0.04, 0.04, 0.03, 24), m.steel);
    collar.rotation.z = Math.PI / 2;
    collar.position.x = s * 0.67;
    g.add(collar);
    const sleeve = mesh(new CylinderGeometry(0.025, 0.025, 0.415, 20), m.chrome);
    sleeve.rotation.z = Math.PI / 2;
    sleeve.position.x = s * (0.685 + 0.2075);
    g.add(sleeve);
    let x = 0.69;
    for (const [r, th] of plates) {
      const p = mesh(plateGeometry(r, th), m.rubber);
      p.position.x = s * (x + th / 2);
      g.add(p);
      x += th + 0.002;
    }
    const clip = mesh(new TorusGeometry(0.03, 0.007, 8, 24), m.accent);
    clip.rotation.y = Math.PI / 2;
    clip.position.x = s * (x + 0.01);
    g.add(clip);
  }
  return g;
}

/** Selectorized weight stack. Returns the group and a function to lift the selected plates. */
export function weightStack(m: EquipmentMaterials, plates = 14, selected = 6) {
  const g = new Group();
  g.name = 'weightStack';
  const plateH = 0.026;
  const w = 0.24;
  const d = 0.1;
  for (const s of [-1, 1]) g.add(tube(new Vector3(s * 0.085, 0, 0), new Vector3(s * 0.085, 1.0, 0), 0.009, m.chrome));
  const moving = new Group();
  const fixed = new Group();
  for (let i = 0; i < plates; i++) {
    const p = box([w, plateH - 0.002, d], m.plate, 0.004);
    p.position.y = 0.04 + i * plateH + plateH / 2;
    (plates - i <= selected ? moving : fixed).add(p);
  }
  const top = box([w * 0.9, 0.03, d * 0.9], m.frame, 0.006);
  top.position.y = 0.04 + plates * plateH + 0.015;
  moving.add(top);
  const pin = tube(new Vector3(0, 0, d / 2), new Vector3(0, 0, d / 2 + 0.05), 0.005, m.accent);
  pin.position.y = 0.04 + (plates - selected) * plateH + plateH / 2;
  moving.add(pin);
  g.add(fixed, moving);
  return {
    group: g,
    setLift(dy: number) {
      moving.position.y = Math.max(0, dy);
    },
  };
}

/** Thin dynamic cable (unit-height cylinder scaled between points). */
export function cableLine(m: EquipmentMaterials, radius = 0.0035): Mesh {
  return mesh(new CylinderGeometry(radius, radius, 1, 8), m.cable, false);
}

export function pulley(m: EquipmentMaterials, radius = 0.045): Group {
  const g = new Group();
  const wheel = mesh(new TorusGeometry(radius, 0.012, 10, 28), m.frame);
  g.add(wheel);
  const hub = mesh(new CylinderGeometry(0.012, 0.012, 0.04, 12), m.chrome);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  return g;
}

export function quatFromAxis(from: Vector3, to: Vector3): Quaternion {
  return new Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
}
