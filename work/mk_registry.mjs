import { writeFileSync } from 'node:fs';
const CR = '\r\n';
const lines = [
  '/** Every ambience engine registers its stop here so one place can silence them all. */',
  'type AmbienceStop = () => void;',
  '',
  'const stops = new Set<AmbienceStop>();',
  '',
  'export function registerAmbienceStop(stop: AmbienceStop): () => void {',
  '  stops.add(stop);',
  '  return () => {',
  '    stops.delete(stop);',
  '  };',
  '}',
  '',
  '/** Silences every ambience engine except the caller own one. */',
  'export function stopOtherAmbiences(except: AmbienceStop) {',
  '  for (const stop of Array.from(stops)) {',
  '    if (stop !== except) stop();',
  '  }',
  '}',
  '',
  '/** Silences every ambience engine: leaving a world, switching conversations, and so on. */',
  'export function stopAllAmbiences() {',
  '  for (const stop of Array.from(stops)) stop();',
  '}',
  ''
];
writeFileSync('src/app/audio/ambienceRegistry.ts', lines.join(CR));
console.log('OK registry');
