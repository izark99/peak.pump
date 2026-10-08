/// <reference lib="webworker" />
import { generateCharacter, type CharacterData, type CharacterQuality } from './generate';

self.onmessage = (e: MessageEvent<{ quality: CharacterQuality }>) => {
  const data: CharacterData = generateCharacter(e.data.quality);
  const transfer: Transferable[] = [];
  for (const p of data.parts) {
    transfer.push(p.positions.buffer, p.normals.buffer, p.indices.buffer, p.skinIndex.buffer, p.skinWeight.buffer, p.muscleA.buffer, p.muscleAW.buffer, p.muscleB.buffer, p.muscleBW.buffer, p.region.buffer, p.ao.buffer);
  }
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(data, transfer);
};
