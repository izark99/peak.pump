import { generateCharacter, type CharacterData, type CharacterQuality } from './generate';

const cache = new Map<string, Promise<CharacterData>>();

/** Generate the character mesh off the main thread (falls back to the main thread). */
export function loadCharacter(q: CharacterQuality): Promise<CharacterData> {
  const key = JSON.stringify(q);
  const hit = cache.get(key);
  if (hit) return hit;
  const p = new Promise<CharacterData>((resolve, reject) => {
    if (typeof Worker === 'undefined') {
      resolve(generateCharacter(q));
      return;
    }
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<CharacterData>) => {
      resolve(e.data);
      w.terminate();
    };
    w.onerror = (e) => {
      w.terminate();
      try {
        resolve(generateCharacter(q));
      } catch {
        reject(e);
      }
    };
    w.postMessage({ quality: q });
  });
  cache.set(key, p);
  return p;
}
