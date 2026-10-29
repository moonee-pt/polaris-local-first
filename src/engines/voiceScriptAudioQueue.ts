/**
 * Sequential audio playback queue built on the Web Audio API.
 *
 * Used by the voice-script (音声模式) pipeline to play one spoken line at a time
 * with real silence between them — instead of stitching everything into a single
 * clip. Blobs arrive from the TTS pipeline one by one; each one is decoded and
 * scheduled after the previous clip plus a configurable gap.
 */

import { getSharedAudioContext } from '../app/audio/sharedAudioContext';

type AudioQueueCallbacks = {
  onStarted: () => void;
  onEnded: () => void;
  onError: () => void;
  onBlocked: () => void;
};

export class AudioQueueManager {
  private queue: AudioBuffer[] = [];
  private nextIndex = 0;
  private isPlaying = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private gapTimer: number | null = null;
  private generation = 0;
  private gapMs: number;
  private callbacks: AudioQueueCallbacks;
  private firstPlayed = false;

  constructor(gapMs: number, callbacks: AudioQueueCallbacks) {
    this.gapMs = gapMs;
    this.callbacks = callbacks;
  }

  private getContext(): AudioContext | null {
    return getSharedAudioContext();
  }

  enqueue(blob: Blob): void {
    const context = this.getContext();
    if (!context) {
      this.callbacks.onError();
      return;
    }

    void (async () => {
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = await context.decodeAudioData(arrayBuffer);
        const gen = this.generation;

        this.queue.push(buffer);

        if (!this.isPlaying) {
          this.isPlaying = true;
          this.nextIndex = 0;
          this.firstPlayed = false;
          void this.start();
        } else if (this.nextIndex >= this.queue.length - 1 && this.gapTimer === null) {
          // Previous wait resolved with hasMore=true because the next blob hadn't
          // arrived yet. Now it has — schedule the clip if the gap is already over.
          const ctx = this.getContext();
          if (ctx && ctx.state === 'running') {
            this.scheduleNext(ctx);
          }
        }

        // Keep the generation alive so stale onended callbacks are ignored.
        void gen;
      } catch {
        this.callbacks.onError();
      }
    })();
  }

  private async start(): Promise<void> {
    const context = this.getContext();
    if (!context) {
      this.callbacks.onBlocked();
      return;
    }

    const startGen = this.generation;

    try {
      if (context.state === 'suspended') {
        await context.resume();
      }
    } catch {
      // Resume failed — autoplay is blocked without a user gesture.
    }

    if (this.generation !== startGen || !this.isPlaying) return;

    if (context.state !== 'running') {
      this.callbacks.onBlocked();
      this.stop();
      return;
    }

    this.scheduleNext(context);
  }

  private scheduleNext(context: AudioContext): void {
    if (this.gapTimer !== null) {
      window.clearTimeout(this.gapTimer);
      this.gapTimer = null;
    }

    if (this.nextIndex >= this.queue.length) return;

    const buffer = this.queue[this.nextIndex];
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);

    const currentIndex = this.nextIndex;
    const gen = this.generation;

    source.onended = () => {
      if (this.generation !== gen) return;
      this.handleClipEnd(context, currentIndex);
    };

    this.currentSource = source;

    if (!this.firstPlayed) {
      this.firstPlayed = true;
      this.callbacks.onStarted();
    }

    source.start();
    this.nextIndex = currentIndex + 1;
  }

  private handleClipEnd(context: AudioContext, _finishedIndex: number): void {
    const hasMore = this.nextIndex < this.queue.length;

    if (!hasMore) {
      // No more clips queued. Tell the pipeline this unit is done.
      this.isPlaying = false;
      this.callbacks.onEnded();
      return;
    }

    // Next clip is already decoded — play it after the gap.
    const gapGen = this.generation;
    this.gapTimer = window.setTimeout(() => {
      this.gapTimer = null;
      if (this.generation !== gapGen) return;
      if (this.nextIndex < this.queue.length) {
        this.scheduleNext(context);
      } else {
        // Next blob hasn't arrived yet. Resolve onEnded so the pipeline can
        // finish this unit; the next enqueue will pick up from here.
        this.isPlaying = false;
        this.callbacks.onEnded();
      }
    }, this.gapMs);
  }

  stop(): void {
    this.generation += 1;

    if (this.gapTimer !== null) {
      window.clearTimeout(this.gapTimer);
      this.gapTimer = null;
    }

    if (this.currentSource) {
      try {
        this.currentSource.onended = null;
        this.currentSource.stop();
      } catch {
        // Already stopped.
      }
      this.currentSource.disconnect();
      this.currentSource = null;
    }

    this.isPlaying = false;
    this.queue = [];
    this.nextIndex = 0;
  }

  get playing(): boolean {
    return this.isPlaying;
  }
}
