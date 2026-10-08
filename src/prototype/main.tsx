import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getExercise } from '@shared/catalog/exercises';
import { MUSCLES, type MuscleId } from '@shared/catalog/muscles';
import type { ExerciseViewer, QualityTier, Theme, ViewerState, ViewPreset } from '../viewer3d';
import { MESSAGES, type Lang } from './messages';
import './prototype.css';

const ITEMS = ['neutral_stance', 'dumbbell_lateral_raise', 'barbell_bench_press', 'seated_cable_row', 'leg_extension'] as const;

function supportsWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function App() {
  const params = new URLSearchParams(location.search);
  const [lang, setLang] = useState<Lang>((params.get('lang') as Lang) || 'vi');
  const [theme, setTheme] = useState<Theme>(
    (params.get('theme') as Theme) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  );
  const [tier, setTier] = useState<QualityTier | null>((params.get('quality') as QualityTier) || null);
  const [item, setItem] = useState<string>(params.get('exercise') || 'dumbbell_lateral_raise');
  const [highlight, setHighlight] = useState(true);
  const [state, setState] = useState<ViewerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<ExerciseViewer | null>(null);
  const t = MESSAGES[lang];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    viewer.current?.setTheme(theme);
  }, [theme]);

  // (re)create the viewer when the quality tier changes
  useEffect(() => {
    if (!supportsWebGL()) {
      setError('webgl');
      return;
    }
    let cancelled = false;
    let unsub: (() => void) | undefined;
    let v: ExerciseViewer | undefined;
    void import('../viewer3d').then(async (mod) => {
      if (cancelled || !host.current) return;
      const q = tier ?? mod.autoTier();
      if (!tier) setTier(q);
      v = new mod.ExerciseViewer(host.current, { tier: q, theme, material: params.get('mode') === 'clay' ? 'clay' : 'final' });
      viewer.current = v;
      unsub = v.subscribe(setState);
      (window as unknown as { __viewer?: ExerciseViewer; __animations?: unknown }).__viewer = v;
      await v.init();
      if (cancelled) return;
      applyExercise(v, mod.ANIMATIONS, item);
    });
    return () => {
      cancelled = true;
      unsub?.();
      v?.dispose();
      viewer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier]);

  useEffect(() => {
    const v = viewer.current;
    if (!v || !state?.ready) return;
    void import('../viewer3d').then((mod) => applyExercise(v, mod.ANIMATIONS, item));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, state?.ready]);

  useEffect(() => {
    viewer.current?.setHighlightEnabled(highlight);
  }, [highlight]);

  const ex = getExercise(item);
  const legend = useMemo(() => ({ primary: ex?.primary ?? [], secondary: ex?.secondary ?? [] }), [ex]);
  const label = (id: string) => (id === 'neutral_stance' ? t.neutral : (getExercise(id)?.name[lang] ?? id));
  const muscleNames = (ids: MuscleId[]) => (ids.length ? ids.map((m) => MUSCLES[m].name[lang]).join(', ') : t.none);

  return (
    <main className="app">
      <header>
        <h1>{t.title}</h1>
        <p>{t.subtitle}</p>
        <div className="toggles">
          <button type="button" onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')} aria-label="language">
            {lang === 'vi' ? 'EN' : 'VI'}
          </button>
          <button type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? t.dark : t.light}
          </button>
        </div>
      </header>

      <nav className="chips" aria-label="exercises">
        {ITEMS.map((id) => (
          <button key={id} type="button" className={id === item ? 'chip active' : 'chip'} onClick={() => setItem(id)} aria-pressed={id === item}>
            {label(id)}
          </button>
        ))}
      </nav>

      <section className="stage">
        <div ref={host} className="canvas-host" data-testid="viewer" />
        {error === 'webgl' && <div className="overlay error">{t.webglError}</div>}
        {!error && !state?.ready && <div className="overlay">{t.loading}</div>}
        {state?.ready && <div className="hint">{t.gestureHint}</div>}
        {state?.ready && state.phase && (
          <div className="phase">
            {t.phase}: {t.phases[state.phase]}
          </div>
        )}
      </section>

      <section className="controls">
        <div className="row">
          <button type="button" className="primary" onClick={() => (state?.playing ? viewer.current?.pause() : viewer.current?.play())}>
            {state?.playing ? t.pause : t.play}
          </button>
          <button type="button" onClick={() => viewer.current?.restart()}>
            {t.restart}
          </button>
          <label className="select">
            <span>{t.speed}</span>
            <select value={state?.speed ?? 1} onChange={(e) => viewer.current?.setSpeed(Number(e.target.value))}>
              {[0.25, 0.5, 1, 1.5].map((s) => (
                <option key={s} value={s}>
                  {s}×
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row">
          <span className="label">{t.views}</span>
          {(['front', 'side', 'back', 'reset'] as ViewPreset[]).map((v) => (
            <button key={v} type="button" onClick={() => viewer.current?.setView(v)}>
              {t[v]}
            </button>
          ))}
        </div>
        <div className="row">
          <label className="switch">
            <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} />
            <span>{t.highlight}</span>
          </label>
          <label className="select">
            <span>{t.quality}</span>
            <select value={tier ?? ''} onChange={(e) => setTier(e.target.value as QualityTier)}>
              {(['low', 'medium', 'high'] as QualityTier[]).map((q) => (
                <option key={q} value={q}>
                  {t[q]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {item !== 'neutral_stance' && (
        <section className="legend" aria-label="legend">
          <div>
            <span className="swatch primary" /> <strong>{t.primary}:</strong> {muscleNames(legend.primary)}
          </div>
          <div>
            <span className="swatch secondary" /> <strong>{t.secondary}:</strong> {muscleNames(legend.secondary)}
          </div>
          <p className="note">{t.legendNote}</p>
        </section>
      )}

      {state?.ready && (
        <section className="stats" aria-label={t.stats}>
          <span>
            {t.fps}: {state.fps || '—'}
          </span>
          <span>
            {t.genTime}: {state.generationMs} ms
          </span>
          <span>
            {t.vertices}: {state.vertices.toLocaleString()}
          </span>
          <span>
            {t.pixelRatio}: {state.pixelRatio}
          </span>
        </section>
      )}
    </main>
  );
}

function applyExercise(v: ExerciseViewer, anims: Readonly<Record<string, import('../viewer3d/exercises/types').ExerciseAnimation>>, id: string) {
  const anim = anims[id];
  if (!anim) return;
  const ex = getExercise(id);
  const map: Partial<Record<MuscleId, 'primary' | 'secondary'>> = {};
  ex?.secondary.forEach((m) => (map[m] = 'secondary'));
  ex?.primary.forEach((m) => (map[m] = 'primary'));
  v.setExercise(anim, map);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
