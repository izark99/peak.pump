import {
  ACESFilmicToneMapping,
  BufferAttribute,
  CircleGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Texture,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { MuscleId } from '@shared/catalog/muscles';
import { buildCharacter, type CharacterObject, type HighlightRole } from '../character/build';
import { loadCharacter } from '../character/load';
import { Rig } from '../rig/rig';
import { cycleDuration, sampleTimeline, type ContactReport, type EquipmentSet, type ExerciseAnimation, type PhaseName } from '../exercises/types';
import { qualitySettings, type QualityTier } from '../quality/quality';

export type ViewPreset = 'front' | 'back' | 'side' | 'reset';
export type Theme = 'light' | 'dark';

export interface ViewerState {
  ready: boolean;
  playing: boolean;
  speed: number;
  phase: PhaseName | null;
  fps: number;
  generationMs: number;
  vertices: number;
  pixelRatio: number;
}

const THEMES: Record<Theme, { bg: number; floorInner: number; floorOuter: number }> = {
  light: { bg: 0xe9edf1, floorInner: 0xd5dae0, floorOuter: 0xe9edf1 },
  dark: { bg: 0x14171c, floorInner: 0x2a2f37, floorOuter: 0x14171c },
};

/**
 * Exercise viewer: owns renderer, scene, camera/controls and the animation loop.
 * Renders only while visible (page visible + element on screen); disposes all GPU resources.
 */
export class ExerciseViewer {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(34, 1, 0.05, 50);
  private controls: OrbitControls;
  private pmrem: PMREMGenerator;
  private envTex: Texture;
  private floor: Mesh;
  private key: DirectionalLight;
  private rig = new Rig();
  private character: CharacterObject | null = null;
  private anim: ExerciseAnimation | null = null;
  private equipment: EquipmentSet | null = null;
  private raf = 0;
  private lastFrame = 0;
  private time = 0;
  private visible = true;
  private onScreen = true;
  private dirty = true;
  private io: IntersectionObserver | null = null;
  private ro: ResizeObserver | null = null;
  private frameTimes: number[] = [];
  private disposed = false;
  private highlight: { map: Partial<Record<MuscleId, HighlightRole>>; enabled: boolean } = { map: {}, enabled: true };
  private listeners = new Set<(s: ViewerState) => void>();
  lastContacts: ContactReport[] = [];
  state: ViewerState;

  constructor(
    private container: HTMLElement,
    private opts: { tier: QualityTier; theme: Theme },
  ) {
    const q = qualitySettings(opts.tier);
    this.renderer = new WebGLRenderer({ antialias: q.antialias, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.maxPixelRatio));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = q.shadows;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.pmrem = new PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.envTex = this.pmrem.fromScene(room, 0.04).texture;
    room.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (m.material as MeshStandardMaterial).dispose();
      }
    });
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.55;

    const hemi = new HemisphereLight(0xffffff, 0x8a8f99, 0.55);
    this.scene.add(hemi);
    this.key = new DirectionalLight(0xfff3e6, 2.1);
    this.key.position.set(1.6, 3.2, 2.2);
    this.key.castShadow = q.shadows;
    this.key.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
    this.key.shadow.camera.left = -1.6;
    this.key.shadow.camera.right = 1.6;
    this.key.shadow.camera.top = 2.2;
    this.key.shadow.camera.bottom = -0.4;
    this.key.shadow.camera.near = 0.5;
    this.key.shadow.camera.far = 8;
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.02;
    this.scene.add(this.key);
    const rim = new DirectionalLight(0xcfe0ff, 1.1);
    rim.position.set(-2.2, 2.4, -2.6);
    this.scene.add(rim);

    const floorGeo = new CircleGeometry(3.2, 64);
    floorGeo.rotateX(-Math.PI / 2);
    floorGeo.setAttribute('color', new BufferAttribute(new Float32Array(floorGeo.attributes.position!.count * 3), 3));
    this.floor = new Mesh(floorGeo, new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
    this.applyTheme(opts.theme);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.enablePan = false;
    this.controls.minDistance = 0.6;
    this.controls.maxDistance = 5.5;
    this.controls.minPolarAngle = 0.15;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.addEventListener('change', () => this.requestRender());

    this.state = {
      ready: false,
      playing: true,
      speed: 1,
      phase: null,
      fps: 0,
      generationMs: 0,
      vertices: 0,
      pixelRatio: this.renderer.getPixelRatio(),
    };

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.io = new IntersectionObserver((entries) => {
      this.onScreen = entries.some((e) => e.isIntersecting);
      this.updateLoop();
    });
    this.io.observe(container);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resize();
  }

  private onVisibility = () => {
    this.visible = document.visibilityState === 'visible';
    this.updateLoop();
  };

  subscribe(fn: (s: ViewerState) => void): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private emit(patch: Partial<ViewerState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  async init(): Promise<void> {
    const q = qualitySettings(this.opts.tier);
    const t0 = performance.now();
    const data = await loadCharacter(q.character);
    if (this.disposed) return;
    this.character = buildCharacter(data);
    this.character.setHighlight(this.highlight.map, this.highlight.enabled);
    this.scene.add(this.character.root);
    this.emit({ ready: true, generationMs: Math.round(performance.now() - t0), vertices: data.stats.vertices });
    this.requestRender();
    this.updateLoop();
  }

  setExercise(anim: ExerciseAnimation, highlight: Partial<Record<MuscleId, HighlightRole>>): void {
    if (this.equipment) {
      this.scene.remove(this.equipment.group);
      this.equipment.dispose();
    }
    this.anim = anim;
    this.equipment = anim.createEquipment();
    this.equipment.group.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    this.scene.add(this.equipment.group);
    this.time = 0;
    this.highlight = { ...this.highlight, map: highlight };
    this.character?.setHighlight(this.highlight.map, this.highlight.enabled);
    this.setView('reset');
    this.poseAt(0);
    this.requestRender();
  }

  setHighlightEnabled(enabled: boolean): void {
    this.highlight = { ...this.highlight, enabled };
    this.character?.setHighlight(this.highlight.map, enabled);
    this.requestRender();
  }

  play(): void {
    this.emit({ playing: true });
    this.lastFrame = 0;
    this.updateLoop();
  }
  pause(): void {
    this.emit({ playing: false });
  }
  restart(): void {
    this.time = 0;
    this.poseAt(0);
    this.requestRender();
  }
  setSpeed(speed: number): void {
    this.emit({ speed });
  }
  /** Jump to a normalized point of the rep cycle (0..1); used by tests/screenshots. */
  seek(fraction: number): void {
    if (!this.anim) return;
    this.time = fraction * cycleDuration(this.anim.phases);
    this.poseAt(this.time);
    this.requestRender();
  }

  setView(v: ViewPreset): void {
    const c = this.anim?.camera ?? { target: [0, 1, 0] as [number, number, number], distance: 3.4, azimuth: 0.3, elevation: 0.1 };
    const target = new Vector3(...c.target);
    const az = v === 'front' ? 0 : v === 'back' ? Math.PI : v === 'side' ? Math.PI / 2 : c.azimuth;
    const el = v === 'reset' ? c.elevation : 0.12;
    const d = c.distance;
    this.camera.position.set(target.x + d * Math.sin(az) * Math.cos(el), target.y + d * Math.sin(el), target.z + d * Math.cos(az) * Math.cos(el));
    this.controls.target.copy(target);
    this.controls.update();
    this.requestRender();
  }

  /** Free camera placement (debug/screenshots). */
  setCamera(target: [number, number, number], distance: number, azimuth: number, elevation: number): void {
    const t = new Vector3(...target);
    this.camera.position.set(t.x + distance * Math.sin(azimuth) * Math.cos(elevation), t.y + distance * Math.sin(elevation), t.z + distance * Math.cos(azimuth) * Math.cos(elevation));
    this.controls.target.copy(t);
    this.controls.update();
    this.requestRender();
  }

  setTheme(theme: Theme): void {
    this.applyTheme(theme);
    this.requestRender();
  }

  private applyTheme(theme: Theme) {
    const t = THEMES[theme];
    this.scene.background = new Color(t.bg);
    const geo = this.floor.geometry;
    const pos = geo.attributes.position!;
    const col = geo.attributes.color as BufferAttribute;
    const inner = new Color(t.floorInner);
    const outer = new Color(t.floorOuter);
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getZ(i)) / 3.2;
      const c = inner.clone().lerp(outer, Math.min(1, Math.pow(r, 0.8)));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }

  private poseAt(time: number) {
    if (!this.anim || !this.character || !this.equipment) return;
    const s = sampleTimeline(this.anim.phases, time);
    this.lastContacts = this.anim.pose(s.r, this.rig, this.equipment, time);
    this.character.applyRig(this.rig);
    if (s.phase !== this.state.phase) this.emit({ phase: s.phase });
  }

  requestRender(): void {
    this.dirty = true;
    this.updateLoop();
  }

  private shouldRun(): boolean {
    return !this.disposed && this.visible && this.onScreen && (this.state.playing || this.dirty);
  }

  private updateLoop() {
    if (this.shouldRun()) {
      if (!this.raf) this.raf = requestAnimationFrame(this.frame);
    } else if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.lastFrame = 0;
    }
  }

  private frame = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    if (this.state.playing && this.anim) {
      this.time += dt * this.state.speed;
      this.poseAt(this.time);
    }
    const damping = this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.dirty = damping;
    this.trackPerformance(dt);
    this.updateLoop();
  };

  private trackPerformance(dt: number) {
    if (dt <= 0 || !this.state.playing) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 60) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    const fps = Math.round(1 / avg);
    // adaptive resolution: keep interaction smooth on weak phones
    const pr = this.renderer.getPixelRatio();
    if (fps < 28 && pr > 1) {
      this.renderer.setPixelRatio(Math.max(1, pr - 0.25));
      this.resize();
    }
    this.emit({ fps, pixelRatio: this.renderer.getPixelRatio() });
  }

  private resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  /** Render a single frame synchronously (screenshots / tests). */
  renderNow(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.io?.disconnect();
    this.ro?.disconnect();
    this.controls.dispose();
    if (this.equipment) this.equipment.dispose();
    this.character?.dispose();
    this.floor.geometry.dispose();
    (this.floor.material as MeshStandardMaterial).dispose();
    this.envTex.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.listeners.clear();
  }
}
