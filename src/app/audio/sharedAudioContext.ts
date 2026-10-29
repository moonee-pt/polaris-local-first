/**
 * One WebAudio context for the whole app: read-aloud clips, the per-line voice-script
 * queue and the body-sound beds all schedule onto the same clock.
 *
 * Browsers cap how many contexts a page may hold (the Web Audio spec leaves the number
 * to the implementation, and mobile kernels keep it small), and a context is only freed
 * by close(). Handing every message row and every spoken line its own context therefore
 * runs the page out, after which `new AudioContext()` throws inside the read-aloud
 * effect and takes the whole chat world down to its error screen.
 */
let shared: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext | null {
  if (shared) return shared;
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    shared = new Ctor();
  } catch {
    // No audio available on this device — stay quiet instead of crashing the screen.
    return null;
  }
  return shared;
}

/** Unlock the shared clock synchronously inside a tap, so playback after an await works. */
export function resumeSharedAudioContext() {
  const context = getSharedAudioContext();
  if (!context || context.state !== 'suspended') return;
  void context.resume().catch(() => {});
}
