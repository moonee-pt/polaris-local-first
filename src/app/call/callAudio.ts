/**
 * One media element backs the whole call. Browsers only allow autoplay on an element
 * that has already played inside a real tap, so the element is created once, unlocked
 * with a silent sample while the "call" button is still being pressed, and then reused
 * for every reply.
 */
let sharedAudio: HTMLAudioElement | null = null;
let silentSampleUrl: string | null = null;
let inUse = false;
let unlocked = false;

function buildSilentSampleUrl() {
  const sampleRate = 8000;
  const samples = Math.floor(sampleRate * 0.12);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, samples * 2, true);
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

export function getCallAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = 'auto';
  }
  return sharedAudio;
}

export function setCallAudioInUse(next: boolean) {
  inUse = next;
}

/** A clip that started playing on its own proves the element no longer needs a gesture. */
export function markCallAudioUnlocked() {
  unlocked = true;
}

export function markCallAudioBlocked() {
  unlocked = false;
}

/** Must be called from inside a user gesture (the tap that opens the call). */
export function primeCallAudio() {
  if (inUse || unlocked || typeof window === 'undefined') return;
  const audio = getCallAudio();
  if (!silentSampleUrl) silentSampleUrl = buildSilentSampleUrl();
  audio.src = silentSampleUrl;
  void audio.play()
    .then(() => {
      unlocked = true;
      if (inUse) return;
      audio.pause();
      audio.removeAttribute('src');
    })
    .catch(() => {
      if (inUse) return;
      audio.removeAttribute('src');
    });
}
