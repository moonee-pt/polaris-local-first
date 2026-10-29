/**
 * Chat read-aloud plays through the Web Audio clock, not an <audio> element. The
 * generated clip arrives after an await, so an element's play() is no longer inside
 * the tap and Android/WebView rejects it (the first read is silent until a second tap).
 * The AudioContext is unlocked synchronously on the tap, and programmatic buffer
 * playback then keeps working — the same path the body track already uses.
 */
import { getSharedAudioContext, resumeSharedAudioContext } from '../audio/sharedAudioContext';

let currentSource: AudioBufferSourceNode | null = null;
let generation = 0;

/** Must be called synchronously inside the tap that starts read-aloud. */
export function primeChatSpeechAudio() {
  resumeSharedAudioContext();
}

export function stopChatSpeechAudio() {
  generation += 1;
  if (!currentSource) return;
  const source = currentSource;
  currentSource = null;
  try {
    source.onended = null;
    source.stop();
  } catch {
    // Already stopped.
  }
  source.disconnect();
}

export type ChatSpeechPlaybackHandlers = {
  /** Fires with the measured clip length the instant the voice starts, so tracks can be planned against it. */
  onStarted?: (durationSec: number) => void;
  onEnded: () => void;
  onError: () => void;
};

export async function playChatSpeechBlob(blob: Blob, handlers: ChatSpeechPlaybackHandlers): Promise<void> {
  const target = getSharedAudioContext();
  if (!target) {
    handlers.onError();
    return;
  }
  try {
    if (target.state === 'suspended') {
      await target.resume();
    }
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = await target.decodeAudioData(arrayBuffer);
    stopChatSpeechAudio();
    const currentGeneration = generation;

    const source = target.createBufferSource();
    source.buffer = buffer;
    source.connect(target.destination);
    source.onended = () => {
      if (generation !== currentGeneration) return;
      currentSource = null;
      source.disconnect();
      handlers.onEnded();
    };
    currentSource = source;
    source.start();
    handlers.onStarted?.(buffer.duration);
  } catch {
    currentSource = null;
    handlers.onError();
  }
}
