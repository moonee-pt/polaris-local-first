import {
  splitVoiceCallCaptions,
  type VoiceCallCaptionSegment,
  type VoiceCallCaptionSourcePart
} from './voiceCallCaption';
import type { FleshCue } from './fleshAmbience';

/** Silence held between two spoken lines written back to back. */
export const VOICE_CALL_LINE_GAP_MS = 400;
/** Silence held where the reply has narration instead of words. */
export const VOICE_CALL_PAUSE_MS = {
  short: 700,
  long: 1300,
  extra: 2000
} as const;

export type VoiceCallSpeechUnit = {
  /** Exactly the text this unit sends to the voice model. */
  tts: string;
  /** Caption segments for this unit: leading narration, then the words themselves. */
  segments: VoiceCallCaptionSegment[];
  /** Weight of the leading narration, which is revealed during the silence before the clip. */
  stageWeight: number;
  /** Weight of every segment in this unit. */
  weight: number;
  /** Silence held before this unit so the previous line can land. */
  pauseBeforeMs: number;
  /** Body-sound markers written in this line, scheduled when the line starts. */
  cues: FleshCue[];
};

export type VoiceCallSpeechPlan = {
  units: VoiceCallSpeechUnit[];
  totalWeight: number;
};

function weightOf(segments: VoiceCallCaptionSegment[]) {
  return segments.reduce((sum, segment) => sum + segment.weight, 0);
}

function leadingStageWeight(segments: VoiceCallCaptionSegment[]) {
  let weight = 0;
  for (const segment of segments) {
    if (segment.kind !== 'stage') break;
    weight += segment.weight;
  }
  return weight;
}

export function createVoiceCallSpeechUnit(input: {
  tts: string;
  caption: string;
  narration?: string[];
  pauseBeforeMs: number;
  cues?: FleshCue[];
  /** The line right before this one was spoken too: the caption breaks between them. */
  continuesPreviousLine?: boolean;
}): VoiceCallSpeechUnit | null {
  const narrationSegments = splitVoiceCallCaptions(
    (input.narration ?? []).map((text) => ({ kind: 'stage' as const, text }))
  );
  const speechSegments = splitVoiceCallCaptions([{ kind: 'speech', text: input.caption }]);
  if (speechSegments.length === 0) return null;
  if (input.continuesPreviousLine) {
    speechSegments.unshift({ text: '\n', weight: 1, kind: 'speech' });
  }

  const segments = [...narrationSegments, ...speechSegments];
  return {
    tts: input.tts,
    segments,
    stageWeight: leadingStageWeight(segments),
    weight: weightOf(segments),
    pauseBeforeMs: Math.max(0, input.pauseBeforeMs),
    cues: input.cues ?? []
  };
}

export function createVoiceCallSpeechPlan(units: VoiceCallSpeechUnit[]): VoiceCallSpeechPlan {
  return {
    units,
    totalWeight: units.reduce((sum, unit) => sum + unit.weight, 0)
  };
}

/**
 * One clip that already holds the whole reply (a cached take) is a single unit: the
 * narration is silent inside that clip, so the audio clock has to carry it.
 */
export function buildWholeClipPlan(caption: VoiceCallCaptionSourcePart[]): VoiceCallSpeechPlan {
  const segments = splitVoiceCallCaptions(caption);
  const weight = weightOf(segments);
  if (segments.length === 0 || weight <= 0) return { units: [], totalWeight: 0 };
  return {
    units: [
      {
        tts: '',
        segments,
        stageWeight: 0,
        weight,
        pauseBeforeMs: 0,
        cues: []
      }
    ],
    totalWeight: weight
  };
}

/** The caption this plan walks through, for callers that only need the parts. */
export function buildCaptionPartsFromPlan(plan: VoiceCallSpeechPlan): VoiceCallCaptionSourcePart[] {
  const parts: VoiceCallCaptionSourcePart[] = [];
  for (const unit of plan.units) {
    for (const segment of unit.segments) {
      const previous = parts[parts.length - 1];
      if (previous && previous.kind === segment.kind) {
        previous.text += segment.text;
        continue;
      }
      parts.push({ kind: segment.kind, text: segment.text });
    }
  }
  return parts;
}

/** Roughly how long a unit's words take to say, used before the clip exists. */
export function estimateSpeechSeconds(text: string): number {
  const chars = Array.from(text.replace(/\[[^\]]*\]/g, '')).filter((char) => !/\s/.test(char)).length;
  return Math.max(1, chars / 5);
}

export function estimatePlanSeconds(plan: VoiceCallSpeechPlan, firstUnitSeconds?: number) {
  return plan.units.reduce(
    (sum, unit, index) =>
      sum +
      unit.pauseBeforeMs / 1000 +
      (index === 0 && firstUnitSeconds !== undefined ? firstUnitSeconds : estimateSpeechSeconds(unit.tts)),
    0
  );
}
